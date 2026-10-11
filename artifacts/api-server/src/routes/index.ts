import { Router, type IRouter } from "express";
import healthRouter from "./health";
import financeRouter from "./finance";
import scenariosRouter from "./scenarios";

const router: IRouter = Router();

router.use(healthRouter);
router.use(financeRouter);
router.use(scenariosRouter);

export default router;
