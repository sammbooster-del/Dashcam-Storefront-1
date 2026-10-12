import type { RequestHandler } from "express";
import { GetAccessStatusResponse } from "@workspace/api-zod";
export const regionalAccess: RequestHandler = (req, res, next) => {
  // Worldwide access: retain the endpoint for older clients, without geolocation.
  if (req.path === "/access-status" && req.method === "GET") {
    res.setHeader("Cache-Control", "private, no-store");
    res.json(GetAccessStatusResponse.parse({
      allowed: true, country: null, code: "ALLOWED", message: "Access allowed",
    }));
    return;
  }
  next();
};
