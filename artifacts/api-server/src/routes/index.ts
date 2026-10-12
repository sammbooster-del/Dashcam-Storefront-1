import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storeRouter from "./store";
import privateProductsRouter from "./privateProducts";
import customerEmailsRouter from "./customerEmails";

const router: IRouter = Router();

router.use(healthRouter);
router.use(customerEmailsRouter);
router.use(privateProductsRouter);
router.use(storeRouter);

export default router;
