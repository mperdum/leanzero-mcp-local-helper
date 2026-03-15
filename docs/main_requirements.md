this mcp's purpose is to switch models for users that like local AI. With lm link from lm studio (please look into its documentation to understand more), a user can connect to multiple devices and use their models as if they're local.

What I envision is that the user wouold have one main primary model that orchestrates using more models from other connected devices using lm link . This MCPs purpose would be to make calls over REST calls to obtain data.

This would require some form of understanding for other devices whether they're already engaged in other inferences. If that is not possible we'd need to create a formula, a JSON and an allocation of responsibilities.

The MCP should alos know to load/unload models to avoid affecting the other machines.

the MCP should know not to try to load more than 1 model per machine for eg regardless of memory RAM

the MCP not try to give more tasks to the same machine / model to avoid over-working it and keep things fast.

the MCP should try to spin up multiple tool calls at once. One tool call for each device.

Ideally the primary model should try to work as a orchestrator and when planning think ahead of time what tool calls need to happen so that it can be done in parallel.

the MCP should primarily be supported only on Cline.