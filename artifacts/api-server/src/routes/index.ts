import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workspaceRouter from "./workspace";
import stagesRouter from "./stages";
import contactsRouter from "./contacts";
import interactionsRouter from "./interactions";
import statsRouter from "./stats";
import mathclubRouter from "./mathclub";
import mcMaterialsRouter from "./mc-materials";
import mcExamsRouter from "./mc-exams";
import mcPaymentsRouter from "./mc-payments";
import mcNotificationsRouter from "./mc-notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspaceRouter);
router.use(stagesRouter);
router.use(contactsRouter);
router.use(interactionsRouter);
router.use(statsRouter);
router.use(mathclubRouter);
router.use(mcMaterialsRouter);
router.use(mcExamsRouter);
router.use(mcPaymentsRouter);
router.use(mcNotificationsRouter);

export default router;
