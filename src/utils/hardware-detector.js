/**
 * Hardware Detector - Cross-platform system resource detection
 * Provides RAM detection, parallel loading limits, and hardware tier classification
 */

export class HardwareDetector {
  constructor() {
    this._cachedRam = null;
    this._cachedTier = null;
    this._cacheTime = 0;
    this.CACHE_TTL = 60000; // 1 minute cache
  }

  /**
   * Detect total system RAM in GB
   * Uses multiple methods for cross-platform compatibility
   * @returns {Promise<number>} Total RAM in GB
   */
  async detectTotalRAM() {
    const now = Date.now();
    
    // Return cached value if still valid
    if (this._cachedRam && (now - this._cacheTime) < this.CACHE_TTL) {
      return this._cachedRam;
    }

    let ramGB = 0;
    
    // Try multiple detection methods
    try {
      // Method 1: Node.js os module (most reliable)
      ramGB = await this.detectRAMNodeOS();
      
      if (ramGB <= 0) {
        // Method 2: Platform-specific commands
        ramGB = await this.detectRAMPlatformSpecific();
      }
      
      if (ramGB <= 0) {
        // Method 3: Parse /proc/meminfo (Linux)
        ramGB = await this.detectRAMFromProcMeminfo();
      }
      
      if (ramGB <= 0) {
        // Method 4: sysctl (macOS/BSD)
        ramGB = await this.detectRAMFromSysctl();
      }
      
      if (ramGB <= 0) {
        // Method 5: wmic (Windows)
        ramGB = await this.detectRAMFromWMIC();
      }
      
      // Fallback: Conservative default
      if (ramGB <= 0) {
        ramGB = 8; // Assume 8GB as safe default
        console.warn(`[Hardware] Could not detect RAM, using default: ${ramGB}GB`);
      }
      
      // Cache the result
      this._cachedRam = ramGB;
      this._cacheTime = now;
      
      console.log(`[Hardware] Detected RAM: ${ramGB}GB`);
      
      return ramGB;
      
    } catch (error) {
      console.error(`[Hardware] RAM detection failed: ${error.message}`);
      return 8; // Safe default
    }
  }

  /**
   * Detect RAM using Node.js os module
   * @returns {number} RAM in GB
   */
  async detectRAMNodeOS() {
    try {
      const os = await import('node:os');
      const totalMemBytes = os.totalmem();
      const ramGB = totalMemBytes / (1024 * 1024 * 1024);
      
      return Math.round(ramGB * 10) / 10; // Round to 1 decimal
    } catch (error) {
      console.warn(`[Hardware] Node.js os module unavailable: ${error.message}`);
      return 0;
    }
  }

  /**
   * Platform-specific RAM detection
   * @returns {number} RAM in GB
   */
  async detectRAMPlatformSpecific() {
    const platform = process.platform;
    
    if (platform === 'linux') {
      return await this.detectRAMFromProcMeminfo();
    } else if (platform === 'darwin') {
      return await this.detectRAMFromSysctl();
    } else if (platform === 'win32') {
      return await this.detectRAMFromWMIC();
    }
    
    return 0;
  }

  /**
   * Parse /proc/meminfo for RAM (Linux)
   * @returns {number} RAM in GB
   */
  async detectRAMFromProcMeminfo() {
    try {
      const fs = await import('node:fs');
      const { exec } = await import('node:child_process');
      
      // Check if /proc/meminfo exists
      try {
        await fs.promises.access('/proc/meminfo', fs.constants.R_OK);
      } catch {
        return 0;
      }
      
      // Read and parse MemTotal
      const meminfo = await fs.promises.readFile('/proc/meminfo', 'utf8');
      const memTotalLine = meminfo.split('\n').find(line => line.startsWith('MemTotal:'));
      
      if (!memTotalLine) return 0;
      
      // Parse: "MemTotal:       8192000 kB"
      const match = memTotalLine.match(/MemTotal:\s+(\d+)\s+kB/);
      if (!match) return 0;
      
      const memTotalKb = parseInt(match[1], 10);
      const ramGB = memTotalKb / (1024 * 1024);
      
      return Math.round(ramGB * 10) / 10;
    } catch (error) {
      console.warn(`[Hardware] /proc/meminfo parsing failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Use sysctl to get RAM (macOS/BSD)
   * @returns {number} RAM in GB
   */
  async detectRAMFromSysctl() {
    try {
      const { exec } = await import('node:child_process');
      
      return new Promise((resolve, reject) => {
        exec('sysctl -n hw.memsize', (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          
          try {
            const bytes = parseInt(stdout.trim(), 10);
            const ramGB = bytes / (1024 * 1024 * 1024);
            resolve(Math.round(ramGB * 10) / 10);
          } catch (parseError) {
            reject(parseError);
          }
        });
      });
    } catch (error) {
      console.warn(`[Hardware] sysctl detection failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Use wmic to get RAM (Windows)
   * @returns {number} RAM in GB
   */
  async detectRAMFromWMIC() {
    try {
      const { exec } = await import('node:child_process');
      
      return new Promise((resolve, reject) => {
        exec('wmic ComputerSystem get TotalPhysicalMemory /Value', (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          
          try {
            // Parse: "TotalPhysicalMemory=17179869184"
            const match = stdout.match(/TotalPhysicalMemory=(\d+)/);
            if (!match) {
              reject(new Error('No match found'));
              return;
            }
            
            const bytes = parseInt(match[1], 10);
            const ramGB = bytes / (1024 * 1024 * 1024);
            resolve(Math.round(ramGB * 10) / 10);
          } catch (parseError) {
            reject(parseError);
          }
        });
      });
    } catch (error) {
      console.warn(`[Hardware] wmic detection failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get hardware tier based on RAM and CPU
   * Tiers: low, medium, high, ultra
   * @returns {Promise<string>} Hardware tier
   */
  async getHardwareTier() {
    if (this._cachedTier && (Date.now() - this._cacheTime) < this.CACHE_TTL) {
      return this._cachedTier;
    }

    const ramGB = await this.detectTotalRAM();
    
    // Get CPU cores using os module
    let cpuCores = 0;
    try {
      const os = await import('node:os');
      cpuCores = os.cpus().length;
    } catch (error) {
      console.warn(`[Hardware] Could not detect CPU cores: ${error.message}`);
      cpuCores = 4; // Safe default
    }
    
    let tier = 'medium'; // Default
    
    if (ramGB < 8 || cpuCores < 4) {
      tier = 'low';
    } else if (ramGB >= 16 && cpuCores >= 8) {
      tier = 'high';
    } else if (ramGB >= 32 && cpuCores >= 16) {
      tier = 'ultra';
    }
    
    this._cachedTier = tier;
    this._cacheTime = Date.now();
    
    console.log(`[Hardware] Tier: ${tier} (RAM: ${ramGB}GB, CPU cores: ${cpuCores})`);
    
    return tier;
  }

  /**
   * Calculate optimal parallel loading limit based on hardware
   * @returns {Promise<number>} Maximum parallel model loads
   */
  async getParallelLoadLimit() {
    const ramGB = await this.detectTotalRAM();
    const tier = await this.getHardwareTier();
    
    // Base limits by RAM
    let limit;
    if (ramGB < 8) {
      limit = 1;
    } else if (ramGB < 16) {
      limit = 2;
    } else if (ramGB < 32) {
      limit = 3;
    } else {
      limit = 4;
    }
    
    // Adjust by tier
    if (tier === 'low') limit = Math.max(1, limit - 1);
    if (tier === 'high') limit = Math.min(4, limit + 1);
    if (tier === 'ultra') limit = Math.min(6, limit + 2);
    
    console.log(`[Hardware] Parallel load limit: ${limit} (${tier} tier)`);
    
    return limit;
  }

  /**
   * Get maximum model size based on RAM
   * Returns recommended maximum model size in GB
   * @returns {Promise<string>} Max model size category
   */
  async getMaxModelSize() {
    const ramGB = await this.detectTotalRAM();
    
    if (ramGB < 8) {
      return 'small'; // <3B parameters
    } else if (ramGB < 16) {
      return 'medium'; // 3-7B parameters
    } else if (ramGB < 32) {
      return 'large'; // 7-13B parameters
    } else {
      return 'xlarge'; // 13B+ parameters
    }
  }

  /**
   * Get comprehensive hardware profile
   * @returns {Promise<Object>} Hardware profile
   */
  async getHardwareProfile() {
    const ramGB = await this.detectTotalRAM();
    const tier = await this.getHardwareTier();
    const parallelLimit = await this.getParallelLoadLimit();
    const maxModelSize = await this.getMaxModelSize();
    
    // Get CPU cores using os module
    let cpuCores = 0;
    try {
      const os = await import('node:os');
      cpuCores = os.cpus().length;
    } catch (error) {
      console.warn(`[Hardware] Could not detect CPU cores: ${error.message}`);
      cpuCores = 4; // Safe default
    }
    
    return {
      ramGB,
      tier,
      parallelLoadLimit: parallelLimit,
      maxModelSize,
      cpuCores,
      platform: process.platform,
      architecture: process.arch,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear cache (useful for testing or re-detection)
   */
  clearCache() {
    this._cachedRam = null;
    this._cachedTier = null;
    this._cacheTime = 0;
    console.log(`[Hardware] Cache cleared`);
  }
}

// Export singleton instance
export const hardwareDetector = new HardwareDetector();