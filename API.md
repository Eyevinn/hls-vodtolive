<a name="HLSVod"></a>

## HLSVod
**Kind**: global class  

* [HLSVod](#HLSVod)
    * [new HLSVod(vodManifestUri, splices, timeOffset, startTimeOffset, header, opts)](#new_HLSVod_new)
    * [.defaultAudioGroupAndLang](#HLSVod+defaultAudioGroupAndLang)
    * [.load()](#HLSVod+load)
    * [.loadAfter(previousVod)](#HLSVod+loadAfter)
    * [.reload(mediaSeqNo, additionalSegments, additionalAudioSegments, insertAfter)](#HLSVod+reload) ⇒
    * [.addMetadata(key, value)](#HLSVod+addMetadata)
    * [.getVodUri()](#HLSVod+getVodUri)
    * [.getLiveMediaSequenceSegments(seqIdx)](#HLSVod+getLiveMediaSequenceSegments)
    * [.getLiveAudioSequenceSegments(seqIdx)](#HLSVod+getLiveAudioSequenceSegments)
    * [.getMediaSegments()](#HLSVod+getMediaSegments)
    * [.getLiveMediaSequenceAudioSegments(audioGroupId, audioLanguage, seqIdx)](#HLSVod+getLiveMediaSequenceAudioSegments)
    * [.getLiveMediaSequenceSubtitleSegments(subtitleGroupId, subtitleLanguage, seqIdx)](#HLSVod+getLiveMediaSequenceSubtitleSegments)
    * [.getBandwidths()](#HLSVod+getBandwidths)
    * [.getLiveMediaSequencesCount()](#HLSVod+getLiveMediaSequencesCount)
    * [.getLastSequenceMediaSequenceValue()](#HLSVod+getLastSequenceMediaSequenceValue)
    * [.getLastSequenceMediaSequenceValueAudio()](#HLSVod+getLastSequenceMediaSequenceValueAudio)
    * [.getLastSequenceMediaSequenceValueSubtitle()](#HLSVod+getLastSequenceMediaSequenceValueSubtitle)
    * [.getLiveMediaSequences(offset, bandwidth, seqIdx, discOffset, padding, forceTargetDuration)](#HLSVod+getLiveMediaSequences)
    * [.getLiveMediaAudioSequences()](#HLSVod+getLiveMediaAudioSequences)
    * [.getLiveMediaSubtitleSequences()](#HLSVod+getLiveMediaSubtitleSequences)
    * [.getUsageProfiles()](#HLSVod+getUsageProfiles)
    * [.getLastDiscontinuity()](#HLSVod+getLastDiscontinuity)
    * [.getLastDiscontinuityAudio()](#HLSVod+getLastDiscontinuityAudio)
    * [.getDeltaTimes()](#HLSVod+getDeltaTimes)
    * [.getPlayheadPositions()](#HLSVod+getPlayheadPositions)
    * [.releasePreviousVod()](#HLSVod+releasePreviousVod)
    * [.getDuration()](#HLSVod+getDuration)
    * [.getLastUsedDiscSeq()](#HLSVod+getLastUsedDiscSeq)
    * [._copyAudioGroupsFromPrevious()](#HLSVod+_copyAudioGroupsFromPrevious)
    * [._copySubtitleGroupsFromPrevious()](#HLSVod+_copySubtitleGroupsFromPrevious)

<a name="new_HLSVod_new"></a>

### new HLSVod(vodManifestUri, splices, timeOffset, startTimeOffset, header, opts)
Create an HLS VOD instance


| Param | Type | Description |
| --- | --- | --- |
| vodManifestUri | <code>string</code> | the uri to the master manifest of the VOD |
| splices | <code>Object</code> | an array of ad splice objects |
| timeOffset | <code>number</code> | time offset as unix timestamp ms |
| startTimeOffset | <code>number</code> | start time offset in N ms from start |
| header | <code>string</code> | prepend the m3u8 playlist with this text |
| opts | <code>string</code> | other options |

<a name="HLSVod+defaultAudioGroupAndLang"></a>

### hlsVod.defaultAudioGroupAndLang
TODO: Handle case where prevVod and nextVod have many groups and languages, but none of them match.
Currently, it only sets a default if there is only one possible group and lang to match with on
the prevVod.

**Kind**: instance property of [<code>HLSVod</code>](#HLSVod)  
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

<a name="HLSVod+reload"></a>

### hlsVod.reload(mediaSeqNo, additionalSegments, additionalAudioSegments, insertAfter) ⇒
Removes all segments that come before or after a specified media sequence.
Then adds the new additional segments in front or behind.
It finally creates new media sequences with the updated collection of segments.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
**Returns**: A promise that new Media Sequences have been made  

| Param | Type | Description |
| --- | --- | --- |
| mediaSeqNo | <code>number</code> | The media Sequence index that is the live index. |
| additionalSegments | <code>object</code> | New group of segments to merge with a possible subset of this.segments |
| additionalAudioSegments | <code>object</code> | New group of audio segments to merge with a possible subset of this.segments |
| insertAfter | <code>boolean</code> | Whether the additional segments are to be added in front of the live index or behind |

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

<a name="HLSVod+getLiveAudioSequenceSegments"></a>

### hlsVod.getLiveAudioSequenceSegments(seqIdx)
Get all audio segments (duration, uri) for a specific media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getMediaSegments"></a>

### hlsVod.getMediaSegments()
Get all segments (duration, uri)

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequenceAudioSegments"></a>

### hlsVod.getLiveMediaSequenceAudioSegments(audioGroupId, audioLanguage, seqIdx)
Get all audio segments (duration, uri) for a specific media sequence based on audio group and lang

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| audioGroupId | <code>string</code> | audio group Id |
| audioLanguage | <code>string</code> | audio language |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getLiveMediaSequenceSubtitleSegments"></a>

### hlsVod.getLiveMediaSequenceSubtitleSegments(subtitleGroupId, subtitleLanguage, seqIdx)
Get all subtitle segments (duration, uri) for a specific media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| subtitleGroupId | <code>string</code> | subtitle group Id |
| subtitleLanguage | <code>string</code> | subtitle language |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getBandwidths"></a>

### hlsVod.getBandwidths()
Get the available bandwidths for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequencesCount"></a>

### hlsVod.getLiveMediaSequencesCount()
Get the number of media sequences for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastSequenceMediaSequenceValue"></a>

### hlsVod.getLastSequenceMediaSequenceValue()
Get the media-sequence value for the last media sequence of this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastSequenceMediaSequenceValueAudio"></a>

### hlsVod.getLastSequenceMediaSequenceValueAudio()
Get the media-sequence value for the last audio media sequence of this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastSequenceMediaSequenceValueSubtitle"></a>

### hlsVod.getLastSequenceMediaSequenceValueSubtitle()
Get the media-sequence value for the last subtitle media sequence of this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequences"></a>

### hlsVod.getLiveMediaSequences(offset, bandwidth, seqIdx, discOffset, padding, forceTargetDuration)
Get the HLS live media sequence for a specific media sequence and bandwidth

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| offset | <code>number</code> | add this offset to all media sequences in the EXT-X-MEDIA-SEQUENCE tag |
| bandwidth | <code>string</code> |  |
| seqIdx | <code>number</code> |  |
| discOffset | <code>number</code> | add this offset to all discontinuity sequences in the EXT-X-DISCONTINUITY-SEQUENCE tag |
| padding | <code>number</code> | add extra seconds on the EXT-X-TARGETDURATION |
| forceTargetDuration | <code>number</code> | enforce a fixed EXT-X-TARGETDURATION |

<a name="HLSVod+getLiveMediaAudioSequences"></a>

### hlsVod.getLiveMediaAudioSequences()
Gets a hls/makes m3u8-file with all of the correct audio segments
belonging to a given groupID & language for a particular sequence.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSubtitleSequences"></a>

### hlsVod.getLiveMediaSubtitleSequences()
Gets a hls/makes m3u8-file with all of the correct subtitle segments
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
<a name="HLSVod+getLastDiscontinuityAudio"></a>

### hlsVod.getLastDiscontinuityAudio()
Get the last audio discontinuity sequence number

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
<a name="HLSVod+getDuration"></a>

### hlsVod.getDuration()
Returns the current duration calculated from the sum of the duration of all segments

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastUsedDiscSeq"></a>

### hlsVod.getLastUsedDiscSeq()
Returns the last added Discontinuity sequence count from getLiveMediaSequences()

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+_copyAudioGroupsFromPrevious"></a>

### hlsVod.\_copyAudioGroupsFromPrevious()
Gets previous VOD's audio -groupIds, -langs, -segments from its last sequence
and adds them to the current VOD's this.audioSegments property.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+_copySubtitleGroupsFromPrevious"></a>

### hlsVod.\_copySubtitleGroupsFromPrevious()
Gets previous VOD's subtitle -groupIds, -langs, -segments from its last sequence
and adds them to the current VOD's this.subtitleSegments property.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
