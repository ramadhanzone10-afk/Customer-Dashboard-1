import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workspaceRouter from "./workspace";
import stagesRouter from "./stages";
import contactsRouter from "./contacts";
import interactionsRouter from "./interactions";
import statsRouter from "./stats";
import mathclubRouter from "./mathclub";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspaceRouter);
router.use(stagesRouter);
router.use(contactsRouter);
router.use(interactionsRouter);
router.use(statsRouter);
router.use(mathclubRouter);

export default router;
