import { z } from "zod";

export const worksiteSchema = z.object({
  name: z.string().min(2), address_line_1: z.string().min(2), address_line_2: z.string().optional(),
  city: z.string().min(2), state: z.string().min(2), postal_code: z.string().min(3), country: z.string().default("US"),
  timezone: z.string().min(3), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(),
  geofence_radius_meters: z.number().int().min(25).max(50000), require_location: z.boolean(), capture_break_location: z.boolean().default(false),
  location_mode: z.enum(["STRICT", "FLAG", "OPTIONAL"]), status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
