/* URL query is synchronized after hydration. */
/* oxlint-disable react/react-compiler */
'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import Voting from '@/components/voting';
export default function VotePage(){const [depth,setDepth]=useState(2000);useEffect(()=>{const d=Number(new URLSearchParams(location.search).get('depth')??2000);if(Number.isFinite(d)&&d>=0&&d<=11000)setDepth(Math.round(d))},[]);return <main className="vote-page"><Link href="/">← ABYSS COMMONS</Link><span className="eyebrow">A COMMUNITY QUESTION</span><h1>60 ROV minutes.</h1><p>Where would you look next?</p><div className="virtual-notice">Hypothetical / virtual exploration time. No real NOAA ROV time is allocated.</div><Voting minDepth={depth}/></main>}
