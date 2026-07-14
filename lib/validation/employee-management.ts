import { z } from "zod";

const idList=z.array(z.string().uuid()).max(100).default([]);
export const employeeCreateSchema=z.object({
  employeeNumber:z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9._-]+$/),
  preferredName:z.string().trim().min(1).max(80),
  pin:z.string().regex(/^\d{4,8}$/),
  worksiteIds:idList,
  teamGroupIds:idList,
});
export const employeeUpdateSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("resetPin"),pin:z.string().regex(/^\d{4,8}$/)}),
  z.object({action:z.literal("assignments"),worksiteIds:idList,teamGroupIds:idList}),
  z.object({action:z.literal("profile"),preferredName:z.string().trim().min(1).max(80),status:z.enum(["ACTIVE","INACTIVE"])}),
]);
export const teamGroupSchema=z.object({name:z.string().trim().min(1).max(80),description:z.string().trim().max(300).default(""),status:z.enum(["ACTIVE","INACTIVE"]).default("ACTIVE")});
