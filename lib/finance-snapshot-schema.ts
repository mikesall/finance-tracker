export * from "../finance-core/schemas/finance-snapshot-schema.ts";
import {z} from "zod";
import {nativeSnapshotSchema,nativeView} from "../finance-core/schemas/finance-native-schema.ts";
export const snapshotWriteSchema=z.object({expectedRevision:z.number().int().nonnegative(),snapshot:nativeSnapshotSchema}).strict();
export const snapshotView=nativeView;
