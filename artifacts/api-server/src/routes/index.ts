import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storeRouter from "./store";
import privateProductsRouter from "./privateProducts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(privateProductsRouter);
router.use(storeRouter);

export default router;
