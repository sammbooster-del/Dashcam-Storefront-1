import type { RequestHandler } from "express";
import { GetAccessStatusResponse } from "@workspace/api-zod";
import { clientIps, countryForRequest, createCountryLookup } from "../lib/visitorCountry";

const lookupCountry = createCountryLookup();

export const regionalAccess: RequestHandler = async (req, res, next) => {
  // Health checks must remain available to the publishing infrastructure.
  if (req.path === "/healthz") { next(); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const ips = clientIps(req.get("x-forwarded-for"), req.socket.remoteAddress);
  // Local development and screenshots have no public IP. Never bypass in production.
  const localDevelopment = !ips.length && process.env.NODE_ENV !== "production";
  const country = await countryForRequest(ips, lookupCountry);
  if (country === "IN") {
    res.status(403).json({
      allowed: false, country, code: "REGION_BLOCKED",
      message: "Everyday Finds is not available in your region.",
    });
    return;
  }
  if (!country && !localDevelopment) {
    res.setHeader("Retry-After", "10");
    res.status(503).json({
      allowed: false, country: null, code: "LOCATION_UNAVAILABLE",
      message: "We couldn't verify your region. Please try again shortly.",
    });
    return;
  }
  if (req.path === "/access-status" && req.method === "GET") {
    res.json(GetAccessStatusResponse.parse({
      allowed: true, country, code: "ALLOWED", message: "Access allowed",
    }));
    return;
  }
  next();
};
