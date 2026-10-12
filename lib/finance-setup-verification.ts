import {reconcileFinanceInventory} from "../finance-core/schemas/finance-inventory-schema.ts";
import {readSnapshot} from "./finance-snapshots";
import {readReportingPolicy} from "./finance-reporting-policy";
export async function verifyFinanceSetup(){const [{snapshot},{policy}]=await Promise.all([readSnapshot(),readReportingPolicy()]);return reconcileFinanceInventory((snapshot||{}) as any,policy);}
