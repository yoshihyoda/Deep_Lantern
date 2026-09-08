export type Provenance = 'direct' | 'indirect' | 'unknown' | 'land';
export interface SourceRef {id:string;provider:string;dataset:string;retrievedAt:string;attribution:string;sourceUrl:string;status:'snapshot'|'cached'|'live';license:string;notes:string[];metadataUrl:string}
export interface Terrain {width:number;height:number;bbox:[number,number,number,number];elevation:number[];tid:number[]}
export interface GridMetrics {id:string;row:number;col:number;centerLat:number;centerLon:number;meanDepth:number;terrainRelief:number;directFraction:number;indirectFraction:number;mixedUnknownFraction:number;rovTrackKm:number;obisRecords:number;oceanFraction:number;sourceIds:string[]}
export interface Candidate extends GridMetrics {archetype:'A'|'B'|'C';title:string;subtitle:string;score:number}
export interface EvidenceStatement {statement:string;sourceIds:string[]}
export interface DiveBrief {candidateId:string;title:string;known:EvidenceStatement[];dataGaps:EvidenceStatement[];whyExplore:EvidenceStatement[];questions:string[];caveats:string[];evidenceSources:string[]}
export interface Layers {terrain:boolean;provenance:boolean;rov:boolean;obis:boolean;grid:boolean}
export interface UiEvent {type:'layers'|'truth'|'focus'|'candidates'|'brief';value:unknown}
export interface Track {type:'Feature';id:string;geometry:{type:'LineString';coordinates:[number,number][]};properties:{dive_id:string;reached_bottom:boolean;source_url:string;date_as_listed_by_noaa:string;platform:string;note?:string;vertex_count:number}}
export interface Coverage {type:'Feature';id:string;geometry:{type:'Polygon';coordinates:[number,number][][]};properties:{occurrence_count:number}}
