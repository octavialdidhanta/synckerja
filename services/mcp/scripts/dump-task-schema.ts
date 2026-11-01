import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createTaskInput } from "../src/tools/tasks/create";
import { updateTaskSchema } from "../src/tools/tasks/update";
import { taskListInput } from "../src/tools/tasks/list";
import { publishedToolShape } from "../src/mcp/handler";

function show(name: string, schema: z.ZodTypeAny) {
  const wrapped = z.object(publishedToolShape(schema));
  const json = zodToJsonSchema(wrapped, { strictUnions: true, pipeStrategy: "input" });
  console.log("---", name);
  console.log(JSON.stringify(json, null, 2));
}

show("create", createTaskInput);
show("update", updateTaskSchema);
show("list", taskListInput);
