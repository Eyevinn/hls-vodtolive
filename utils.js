const fetch = require("node-fetch");
const { AbortController } = require("abort-controller");
const debug = require("debug")("hls-vodtolive");

function keysToM3u8(keys) {
  let m3u8 = "";
  for (const keyFormat of Object.keys(keys)) {
    const key = keys[keyFormat];
    m3u8 += `#EXT-X-KEY:METHOD=${key.method}`;
    m3u8 += key.uri ? `,URI=${key.uri}` : "";
    m3u8 += key.iv ? `,IV=${key.iv}` : "";
    m3u8 += key.keyId ? `,KEYID=${key.keyId}` : "";
    m3u8 += key.keyFormatVersions ? `,KEYFORMATVERSIONS=${key.keyFormatVersions}` : "";
    m3u8 += key.keyFormat ? `,KEYFORMAT=${key.keyFormat}` : "";
    m3u8 += "\n";
  }
  return m3u8;
}

function daterangeAttribute (key, attr) {
  if (key === "planned-duration" || key === "duration") {
    return key.toUpperCase() + "=" + `${attr.toFixed(3)}`;
  } else {
    return key.toUpperCase() + "=" + `"${attr}"`;
  }
}

function urlResolve(from, to) {
  const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
  if (resolvedUrl.protocol === 'resolve:') {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl;
    return pathname + search + hash;
  }
  return resolvedUrl.toString();
}

function segToM3u8(v, i, len, nextSegment, previousSegment) {
  let m3u8 = "";

  if (previousSegment != null) {
    if (previousSegment.discontinuity) {
      if (v.initSegment) {
        let byteRangeStr = "";
        if (v.initSegmentByteRange) {
          byteRangeStr = `,BYTERANGE="${v.initSegmentByteRange}"`;
        }
        m3u8 += `#EXT-X-MAP:URI="${v.initSegment}"${byteRangeStr}\n`;
      }
      if (v.keys) {
        m3u8 += keysToM3u8(v.keys);
      }  
    }
  }

  if (i === 0) {
    if (v.initSegment) {
      let byteRangeStr = "";
      if (v.initSegmentByteRange) {
        byteRangeStr = `,BYTERANGE="${v.initSegmentByteRange}"`;
      }
      m3u8 += `#EXT-X-MAP:URI="${v.initSegment}"${byteRangeStr}\n`;
    }
    if (v.keys) {
      m3u8 += keysToM3u8(v.keys);
    }
  }

  if (!v.discontinuity) {
    if (v.daterange) {
      const dateRangeAttributes = Object.keys(v.daterange)
        .map((key) => daterangeAttribute(key, v.daterange[key]))
        .join(",");
      if ((nextSegment && !nextSegment.timelinePosition) && v.daterange["start-date"]) {
        m3u8 += "#EXT-X-PROGRAM-DATE-TIME:" + v.daterange["start-date"] + "\n";
      }
      m3u8 += "#EXT-X-DATERANGE:" + dateRangeAttributes + "\n";
    }

    if (v.cue && v.cue.out) {
      if (v.cue.scteData) {
        m3u8 += "#EXT-OATCLS-SCTE35:" + v.cue.scteData + "\n";
      }
      if (v.cue.assetData) {
        m3u8 += "#EXT-X-ASSET:" + v.cue.assetData + "\n";
      }
      m3u8 += "#EXT-X-CUE-OUT:DURATION=" + v.cue.duration + "\n";
    }
    if (v.cue && v.cue.cont) {
      if (v.cue.scteData) {
        m3u8 += "#EXT-X-CUE-OUT-CONT:ElapsedTime=" + v.cue.cont + ",Duration=" + v.cue.duration + ",SCTE35=" + v.cue.scteData + "\n";
      } else {
        m3u8 += "#EXT-X-CUE-OUT-CONT:" + v.cue.cont + "/" + v.cue.duration + "\n";
      }
    }
    if (v.cue && v.cue.in) {
      if (nextSegment && nextSegment.discontinuity && i + 1 == len - 1) {
        // Do not add a closing cue-in if next is not a segment and last one in the list
      } else {
        m3u8 += "#EXT-X-CUE-IN" + "\n";
      }
    }
    if (v.uri) {
      if (v.timelinePosition) {
        const d = new Date(v.timelinePosition);
        m3u8 += "#EXT-X-PROGRAM-DATE-TIME:" + d.toISOString() + "\n";
      }
      m3u8 += "#EXTINF:" + v.duration.toFixed(3) + ",\n";
      if (v.byteRange) {
        m3u8 += `#EXT-X-BYTERANGE:${v.byteRange}\n`;
      }
      m3u8 += v.uri + "\n";
    }
  } else {
    if (i != 0 && i != len - 1) {
      m3u8 += "#EXT-X-DISCONTINUITY\n";
      if (v.cue && v.cue.in) {
        m3u8 += "#EXT-X-CUE-IN" + "\n";
      }
    }
    if (v.daterange && i != len - 1) {
      const dateRangeAttributes = Object.keys(v.daterange)
        .map((key) => daterangeAttribute(key, v.daterange[key]))
        .join(",");
      if ((nextSegment && !nextSegment.timelinePosition) && v.daterange["start-date"]) {
        m3u8 += "#EXT-X-PROGRAM-DATE-TIME:" + v.daterange["start-date"] + "\n";
      }
      m3u8 += "#EXT-X-DATERANGE:" + dateRangeAttributes + "\n";
    }
  }
  return m3u8;
}

async function fetchWithRetry(uri, opts, maxRetries, retryDelayMs, timeoutMs, debug) {
  if (!debug) {
    var debug = (msg) => {
      if (process.env.ENVIRONMENT === "development") {
        console.log(msg);
      }
    };
  }
  let tryFetchCount = 0;
  const RETRY_LIMIT = maxRetries || 5;
  const TIMEOUT_LIMIT = timeoutMs || 10 * 1000;
  const RETRY_DELAY = retryDelayMs || 1000;
  while (tryFetchCount < RETRY_LIMIT) {
    tryFetchCount++;
    debug(`Fetching URI -> ${uri}, attempt ${tryFetchCount} of ${maxRetries}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      `Request Timeout after (${TIMEOUT_LIMIT})ms @ ${uri}`;
      controller.abort();
    }, TIMEOUT_LIMIT);
    try {
      const fetchOpts = Object.assign({ signal: controller.signal }, opts);
      const response = await fetch(uri, fetchOpts);

      if (response.status >= 400 && response.status < 600) {
        const msg = `Bad response from URI: ${uri}\nReturned Status Code: ${response.status}`;
        debug(msg);
        if (tryFetchCount === maxRetries) {
          return Promise.resolve(response);
        }
        debug(`Going to try fetch again in ${RETRY_DELAY}ms`);
        await timer(RETRY_DELAY);
        continue;
      }
      // Return Good response
      return Promise.resolve(response);
    } catch (err) {
      debug(`Node-Fetch Error on URI: ${uri}\nFull Error -> ${err}`);
      if (tryFetchCount === maxRetries) {
        return Promise.reject(err);
      }
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function findIndexReversed(arr, fn) {
  const size = arr.length;
  for (let i = size - 1; i >= 0; i--) {
    const item = arr[i];
    const verdict = fn(item);
    if (verdict) {
      return i;
    }
  }
  return -1;
};


module.exports = {
  daterangeAttribute,
  keysToM3u8,
  segToM3u8,
  urlResolve,
  fetchWithRetry,
  findIndexReversed
}