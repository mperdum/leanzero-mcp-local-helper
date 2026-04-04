/**
 * Swarm Context Manager - Distributed "Blackboard" for subagents
 * Manages ephemeral shared state during an active orchestration session.
 */

class SwarmContextManager {
  constructor() {
    this._sessions = new Map(); // sessionId -> Map(key -> value)
  }

  /**
   * Initialize a new context session
   * @param {string} sessionId 
   */
  createSession(sessionId) {
    if (!this._sessions.has(sessionId)) {
      this._sessions.set(sessionId, new Map());
    }
    console.log(`[SwarmContext] Created session: ${sessionId}`);
  }

  /**
   * Publish a finding to the shared context
   * @param {string} sessionId 
   * @param {string} key - A unique identifier for this piece of information
   * @param {string} value - The content/insight discovered
   */
  publish(sessionId, key, value) {
    const session = this._sessions.get(sessionId);
    if (session) {
      session.set(key, value);
      console.log(`[SwarmContext] [${sessionId}] Published: ${key}`);
    }
  }

  /**
   * Retrieve all findings for a session as a summarized context block
   * @param {string} sessionId 
   * @returns {string} A formatted string of all shared knowledge
   */
  getSharedContext(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session || session.size === 0) return "";

    let contextBlock = "### SHARED SWARM KNOWLEDGE (PREVIOUS FINDINGS):\n";
    for (const [key, value] of session.entries()) {
      contextBlock += `- **${key}**: ${value}\n`;
    }
    return contextBlock;
  }

  /**
   * Get a specific finding
   * @param {string} sessionId 
   * @param {string} key 
   */
  getFinding(sessionId, key) {
    const session = this._sessions.get(sessionId);
    return session ? session.get(key) : null;
  }

  /**
   * Terminate a session and clean up memory
   * @param {string} sessionId 
   */
  endSession(sessionId) {
    this._sessions.delete(sessionId);
    console.log(`[SwarmContext] Ended session: ${sessionId}`);
  }

  /**
   * Clear all sessions (emergency/cleanup)
   */
  clearAll() {
    this._sessions.clear();
    console.log("[SwarmContext] Cleared all sessions");
  }
}

export const swarmContextManager = new SwarmContextManager();