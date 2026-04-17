import { Router, type IRouter } from "express";
import healthRouter from "./health";
import botRouter from "./bot";
import walletsRouter from "./wallets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(botRouter);
router.use(walletsRouter);

export default router;
