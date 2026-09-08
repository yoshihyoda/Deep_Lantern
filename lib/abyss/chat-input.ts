import {z} from 'zod';
export const chatRequestSchema=z.object({message:z.string().trim().min(1).max(2000),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(6000)})).max(12).default([]),minDepth:z.number().min(0).max(11000).default(2000),selectedId:z.string().max(10).regex(/^cell-(?:[0-9]|1[0-5])-(?:[0-9]|1[0-5])$/).nullable().default(null)});
