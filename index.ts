export { Feishu2md } from "./nodes/Feishu2md/Feishu2md.node";
export { FeishuApi } from "./credentials/FeishuApi.credentials";

// Community nodes loaders may look for these arrays
export const nodes = [require("./nodes/Feishu2md/Feishu2md.node").Feishu2md];
export const credentials = [
  require("./credentials/FeishuApi.credentials").FeishuApi,
];
