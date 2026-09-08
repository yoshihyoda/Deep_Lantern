import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fromArrayBuffer} from 'geotiff';
import {buildGrid,fractions,candidates} from '../lib/abyss/science';
import type {Terrain,Track,Coverage,SourceRef} from '../lib/abyss/types';
const root='public/data/snapshot/';
const json=async(p:string)=>JSON.parse(await readFile(root+p,'utf8'));
const sums=(await readFile(root+'SHA256SUMS','utf8')).trim().split('\n');
for(const line of sums){const [,expected,path]=line.match(/^([a-f0-9]{64})\s+(.+)$/)!;const actual=createHash('sha256').update(await readFile(root+path)).digest('hex');if(expected!==actual)throw Error('Snapshot integrity failure: '+path)}
const meta=await json('metadata.json'),g=await json('gebco/metadata.json'),n=await json('noaa/metadata.json'),o=await json('obis/metadata.json');
async function raster(path:string){const b=await readFile(root+path);const t=await fromArrayBuffer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));const i=await t.getImage();return {width:i.getWidth(),height:i.getHeight(),bbox:i.getBoundingBox(),values:Array.from((await i.readRasters({interleave:true})) as Int16Array)}}
const e=await raster(meta.datasets.gebco.elevation_geotiff),t=await raster(meta.datasets.gebco.tid_geotiff);
if(e.width!==t.width||e.height!==t.height||e.bbox.some((v,i)=>Math.abs(v-t.bbox[i])>1e-8))throw Error('Unaligned rasters');
const terrain:Terrain={width:e.width,height:e.height,bbox:[-171,-15,-169,-14],elevation:e.values,tid:t.values};
const tracks=(await json('noaa/tracks_bbox.geojson')).features as Track[],coverage=(await json('obis/coverage_geohash8_bbox.geojson')).features as Coverage[];
const grid=buildGrid(terrain,tracks,coverage);
const sources:SourceRef[]=[{id:'gebco',provider:'GEBCO',dataset:'GEBCO_2026 Grid + TID',retrievedAt:g.retrievals[0].retrieved_at_utc,attribution:g.attribution,sourceUrl:(await json('gebco/tid_codes.json')).source_url,status:'snapshot',license:g.license,notes:g.notes,metadataUrl:'/data/snapshot/gebco/metadata.json'},{id:'noaa',provider:'NOAA Ocean Exploration',dataset:'EX1702 · Deep Discoverer',retrievedAt:n.sources[0].retrieved_at_utc,attribution:n.attribution,sourceUrl:n.discovery_url,status:'snapshot',license:n.license,notes:['DIVE01 did not reach bottom.','Paths are not verified bottom-phase-only tracks.','DIVE13 listed date conflicts with expedition overview.'],metadataUrl:'/data/snapshot/noaa/metadata.json'},{id:'obis',provider:'OBIS · IOC-UNESCO',dataset:'American Samoa occurrence coverage',retrievedAt:o.sources[0].retrieved_at_utc,attribution:o.attribution,sourceUrl:o.policy_url,status:'snapshot',license:o.license,notes:o.interpretation,metadataUrl:'/data/snapshot/obis/metadata.json'}];
await mkdir('lib/abyss/generated',{recursive:true});
await writeFile('lib/abyss/generated/tid-codes.json',JSON.stringify(await json('gebco/tid_codes.json')));
await writeFile('public/data/terrain.json',JSON.stringify(terrain));
await writeFile('lib/abyss/generated/grid.json',JSON.stringify(grid));
await writeFile('lib/abyss/generated/sources.json',JSON.stringify(sources));
await writeFile('public/data/summary.json',JSON.stringify({cells:terrain.elevation.length,...fractions(terrain.tid,terrain.elevation),recordCount:grid.reduce((s,c)=>s+c.obisRecords,0),rovKm:grid.reduce((s,c)=>s+c.rovTrackKm,0),gridCells:grid.length}));
console.log(JSON.stringify({verifiedFiles:sums.length,gridCells:grid.length,records:grid.reduce((s,c)=>s+c.obisRecords,0),rovKm:grid.reduce((s,c)=>s+c.rovTrackKm,0),candidates:candidates(grid).map(c=>({id:c.id,archetype:c.archetype,depth:c.meanDepth,score:c.score}))},null,2));
