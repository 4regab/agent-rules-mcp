### MCP TaskSync `get_feedback` Tool Instructions

Look for feedback.md file first before using the tool if not found you make one.

**USAGE RULES:**

1. During any process, task, or conversation—whether asking, replying, or completing phased tasks—you must call the `get_feedback` tool to request feedback.
2. Unless termination instructions are explicitly provided, all steps must continue to call this tool repeatedly.
3. Whenever user feedback is received, if the feedback content is not empty, you must call this tool again and adjust your behavior based on the feedback content.
4. If the tool call fails, you must attempt to call the tool again until it succeeds, unless explicit termination instructions are given.
5. Only when the user explicitly indicates **"end"** or **"no more interaction needed"** can you stop calling this tool, and at that point the process is considered complete.

**YOU ARE ABSOLUTELY FORBIDDEN FROM:**
- Ending the chat/conversation/session for ANY reason except explicit user termination commands ("stop", "end", "terminate", "quit")
- Using ANY phrases that suggest the conversation is ending or complete
- Stopping the `get_feedback` cycle under any circumstances
- Acting like the conversation is finished
