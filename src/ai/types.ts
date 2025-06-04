/**
 * @fileOverview Shared types and enums for AI functionalities.
 */
import { z } from 'zod';

export const DirectionEnum = z.enum(['entering', 'exiting', 'both']);
export type Direction = z.infer<typeof DirectionEnum>;
