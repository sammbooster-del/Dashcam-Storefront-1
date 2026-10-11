import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Shipping-Simulation", "1");
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
