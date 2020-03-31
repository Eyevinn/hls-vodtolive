<a name="HLSVod"></a>

## HLSVod
**Kind**: global class  

* [HLSVod](#HLSVod)
    * [new HLSVod(vodManifestUri, splices, timeOffset, startTimeOffset)](#new_HLSVod_new)
    * [.load()](#HLSVod+load)
    * [.loadAfter(previousVod)](#HLSVod+loadAfter)
    * [.getLiveMediaSequenceSegments(seqIdx)](#HLSVod+getLiveMediaSequenceSegments)
    * [.getLiveMediaSequenceAudioSegments(audioGroupId, seqIdx)](#HLSVod+getLiveMediaSequenceAudioSegments)
    * [.getBandwidths()](#HLSVod+getBandwidths)
    * [.getLiveMediaSequencesCount()](#HLSVod+getLiveMediaSequencesCount)
    * [.getLiveMediaSequences(offset, bandwidth, seqIdx, discOffset)](#HLSVod+getLiveMediaSequences)
    * [.getUsageProfiles()](#HLSVod+getUsageProfiles)
    * [.getLastDiscontinuity()](#HLSVod+getLastDiscontinuity)

<a name="new_HLSVod_new"></a>

### new HLSVod(vodManifestUri, splices, timeOffset, startTimeOffset)
Create an HLS VOD instance


| Param | Type | Description |
| --- | --- | --- |
| vodManifestUri | <code>string</code> | the uri to the master manifest of the VOD |
| splices | <code>Object</code> | an array of ad splice objects |
| timeOffset | <code>number</code> | time offset as unix timestamp ms |
| startTimeOffset | <code>number</code> | start time offset in N ms from start |

<a name="HLSVod+load"></a>

### hlsVod.load()
Load and parse the HLS VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+loadAfter"></a>

### hlsVod.loadAfter(previousVod)
Load and parse the HLS VOD where the first media sequences
contains the end sequences of the previous VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| previousVod | [<code>HLSVod</code>](#HLSVod) | the previous VOD to concatenate to |

<a name="HLSVod+getLiveMediaSequenceSegments"></a>

### hlsVod.getLiveMediaSequenceSegments(seqIdx)
Get all segments (duration, uri) for a specific media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getLiveMediaSequenceAudioSegments"></a>

### hlsVod.getLiveMediaSequenceAudioSegments(audioGroupId, seqIdx)
Get all audio segments (duration, uri) for a specific media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| audioGroupId | <code>string</code> | audio group Id |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getBandwidths"></a>

### hlsVod.getBandwidths()
Get the available bandwidths for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequencesCount"></a>

### hlsVod.getLiveMediaSequencesCount()
Get the number of media sequences for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequences"></a>

### hlsVod.getLiveMediaSequences(offset, bandwidth, seqIdx, discOffset)
Get the HLS live media sequence for a specific media sequence and bandwidth

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| offset | <code>number</code> | add this offset to all media sequences in the EXT-X-MEDIA-SEQUENCE tag |
| bandwidth | <code>string</code> |  |
| seqIdx | <code>number</code> |  |
| discOffset | <code>number</code> | add this offset to all discontinuity sequences in the EXT-X-DISCONTINUITY-SEQUENCE tag |

<a name="HLSVod+getUsageProfiles"></a>

### hlsVod.getUsageProfiles()
Get the usage profile for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastDiscontinuity"></a>

### hlsVod.getLastDiscontinuity()
Get the last discontinuity sequence number

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
