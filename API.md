<a name="HLSVod"></a>

## HLSVod
**Kind**: global class  

* [HLSVod](#HLSVod)
    * [new HLSVod(vodManifestUri, splices, timeOffset, startTimeOffset, header)](#new_HLSVod_new)
    * [.load()](#HLSVod+load)
    * [.loadAfter(previousVod)](#HLSVod+loadAfter)
    * [.addMetadata(key, value)](#HLSVod+addMetadata)
    * [.getVodUri()](#HLSVod+getVodUri)
    * [.getLiveMediaSequenceSegments(seqIdx)](#HLSVod+getLiveMediaSequenceSegments)
    * [.getLiveMediaSequenceAudioSegments(audioGroupId, audioLanguage, seqIdx)](#HLSVod+getLiveMediaSequenceAudioSegments)
    * [.getBandwidths()](#HLSVod+getBandwidths)
    * [.getLiveMediaSequencesCount()](#HLSVod+getLiveMediaSequencesCount)
    * [.getLiveMediaSequences(offset, bandwidth, seqIdx, discOffset)](#HLSVod+getLiveMediaSequences)
    * [.getLiveMediaAudioSequences()](#HLSVod+getLiveMediaAudioSequences)
    * [.getUsageProfiles()](#HLSVod+getUsageProfiles)
    * [.getLastDiscontinuity()](#HLSVod+getLastDiscontinuity)
    * [.getDeltaTimes()](#HLSVod+getDeltaTimes)
    * [.getPlayheadPositions()](#HLSVod+getPlayheadPositions)
    * [.releasePreviousVod()](#HLSVod+releasePreviousVod)
    * [._copyAudioGroupsFromPrevious()](#HLSVod+_copyAudioGroupsFromPrevious)

<a name="new_HLSVod_new"></a>

### new HLSVod(vodManifestUri, splices, timeOffset, startTimeOffset, header)
Create an HLS VOD instance


| Param | Type | Description |
| --- | --- | --- |
| vodManifestUri | <code>string</code> | the uri to the master manifest of the VOD |
| splices | <code>Object</code> | an array of ad splice objects |
| timeOffset | <code>number</code> | time offset as unix timestamp ms |
| startTimeOffset | <code>number</code> | start time offset in N ms from start |
| header | <code>string</code> | prepend the m3u8 playlist with this text |

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

<a name="HLSVod+addMetadata"></a>

### hlsVod.addMetadata(key, value)
Add metadata timed for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>key</code> | EXT-X-DATERANGE attribute key |
| value | <code>\*</code> |  |

<a name="HLSVod+getVodUri"></a>

### hlsVod.getVodUri()
Retrieve master manifest Uri for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequenceSegments"></a>

### hlsVod.getLiveMediaSequenceSegments(seqIdx)
Get all segments (duration, uri) for a specific media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getLiveMediaSequenceAudioSegments"></a>

### hlsVod.getLiveMediaSequenceAudioSegments(audioGroupId, audioLanguage, seqIdx)
Get all audio segments (duration, uri) for a specific media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| audioGroupId | <code>string</code> | audio group Id |
| audioLanguage | <code>string</code> | audio language |
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

<a name="HLSVod+getLiveMediaAudioSequences"></a>

### hlsVod.getLiveMediaAudioSequences()
Gets a hls/makes m3u8-file with all of the correct audio segments
belonging to a given groupID & language for a particular sequence.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getUsageProfiles"></a>

### hlsVod.getUsageProfiles()
Get the usage profile for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastDiscontinuity"></a>

### hlsVod.getLastDiscontinuity()
Get the last discontinuity sequence number

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getDeltaTimes"></a>

### hlsVod.getDeltaTimes()
Get the delta times for each media sequence.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getPlayheadPositions"></a>

### hlsVod.getPlayheadPositions()
Returns the playhead position for each media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+releasePreviousVod"></a>

### hlsVod.releasePreviousVod()
Remove pointers to previous VOD and release to garbage collector

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+_copyAudioGroupsFromPrevious"></a>

### hlsVod.\_copyAudioGroupsFromPrevious()
Gets previous VOD's audio -groupIds, -langs, -segments from its last sequence
and adds them to the current VOD's this.audioSegments property.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
