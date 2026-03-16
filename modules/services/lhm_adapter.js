/**
 * Adapter for LibreHardwareMonitor /data.json format.
 * Converts the recursive Children tree into the psutil-style flat object
 * expected by updatePerfUI.
 */

function parseVal(str) {
  if (!str || typeof str !== 'string') return null;
  const n = parseFloat(str.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function findChild(node, text) {
  const lower = text.toLowerCase();
  return (node?.Children || []).find(c => (c.Text || '').toLowerCase().includes(lower)) || null;
}

function hwCategory(text) {
  const n = (text || '').toLowerCase();
  if (n.includes('intel core') || n.includes('intel(r) core') || n.includes('core i') ||
      n.includes('amd ryzen') || n.includes('ryzen') || n.includes('xeon') ||
      n.includes('core ultra') || n.includes('intel(r) n') || n.includes('intel(r) pentium') ||
      n.includes('intel(r) celeron') || n.includes('intel(r) atom')) return 'cpu';
  if (n.includes('nvidia') || n.includes('geforce') || n.includes('radeon') ||
      n.includes('rtx') || n.includes('gtx') || n.includes('rx ') ||
      n.includes('intel arc') || n.includes('intel(r) uhd') || n.includes('intel(r) hd graphics') ||
      n.includes('intel(r) iris')) return 'gpu';
  if (n === 'generic memory' || (n.includes('memory') && !n.includes('video') && !n.includes('vram') && !n.includes('gpu'))) return 'memory';
  if (n.includes('ethernet') || n.includes('wi-fi') || n.includes('wifi') ||
      n.includes('wlan') || n.includes('wireless') || (n.includes('mediatek') && n.includes('wi')) ||
      n.includes('realtek pcie') || n.includes('realtek rtl') ||
      n.includes('killer e') || n.includes('killer wireless') ||
      n.includes('i219') || n.includes('i225') || n.includes('i226') ||
      n.includes('aquantia') || n.includes('marvell') ||
      (n.includes('network') && !n.includes('cpu') && !n.includes('gpu'))) return 'network';
  if (n.includes('nvme') || n.includes(' ssd') || n.includes(' hdd') || n.includes('evo ') ||
      n.includes('samsung ssd') || n.includes('crucial') || n.includes('sk hynix') ||
      n.includes('kingston') || n.includes('wd ') || n.includes('seagate') ||
      n.includes('micron') || n.includes('sandisk') || n.includes('western digital') ||
      n.includes('toshiba') || n.includes('intel ssd') || n.includes('pny ')) return 'disk';
  return null;
}

// Recursively collect all sensor nodes (leaf nodes with a Value field)
function collectSensors(node, out = []) {
  if (!node) return out;
  const children = node.Children || [];
  if (children.length === 0 && node.Value !== undefined) {
    out.push(node);
  } else {
    for (const c of children) collectSensors(c, out);
  }
  return out;
}

function parseCPU(hw, result) {
  const loadCat = findChild(hw, 'Load');
  if (loadCat) {
    const total = findChild(loadCat, 'CPU Total');
    if (total) result.cpu = parseVal(total.Value);
    result.cpu_percore = (loadCat.Children || [])
      .filter(c => /cpu core #\d/i.test(c.Text || ''))
      .sort((a, b) => {
        const na = parseInt((a.Text || '').match(/#(\d+)/)?.[1] || '0');
        const nb = parseInt((b.Text || '').match(/#(\d+)/)?.[1] || '0');
        return na - nb;
      })
      .map(c => parseVal(c.Value) ?? 0);
  }

  // Find temperature category (Temperatures or Temperature)
  const tempCat = findChild(hw, 'Temperatures') || findChild(hw, 'Temperature');
  if (tempCat) {
    // Priority-ordered sensor name fragments (Intel first, then AMD, then generic)
    const PRIORITY = [
      'CPU Package',   // Intel: primary package sensor
      'Core Average',  // Intel/AMD: average
      'Core Max',      // Intel: max
      'Tctl',          // AMD Zen
      'Tdie',          // AMD Zen die
      'CPU Die',       // AMD older
      'CPU (Tctl',     // AMD Zen2/3 "CPU (Tctl/Tdie)"
      'CPU Core #0',   // first physical core
      'Core #0',
      'CPU Core',
    ];

    // Collect ALL temperature sensors recursively
    const allSensors = collectSensors(tempCat);

    let best = null;
    for (const fragment of PRIORITY) {
      const lower = fragment.toLowerCase();
      const match = allSensors.find(s => (s.Text || '').toLowerCase().includes(lower));
      if (match) {
        const v = parseVal(match.Value);
        if (v !== null && v > 0) { best = v; break; }
      }
    }

    if (best === null) {
      // Absolute fallback: first sensor with a plausible CPU temperature (10–120°C)
      for (const s of allSensors) {
        const v = parseVal(s.Value);
        if (v !== null && v >= 10 && v <= 120) { best = v; break; }
      }
    }

    if (best !== null) result.cpu_temp = best;
  }
}

function parseMemory(hw, result) {
  const loadCat = findChild(hw, 'Load');
  if (loadCat) {
    const mem = findChild(loadCat, 'Memory');
    if (mem) result.memory = parseVal(mem.Value);
  }
  const dataCat = findChild(hw, 'Data');
  if (dataCat) {
    const used = findChild(dataCat, 'Used Memory');
    const avail = findChild(dataCat, 'Available Memory');
    if (used && avail) {
      const usedGB = parseVal(used.Value);
      const availGB = parseVal(avail.Value);
      if (usedGB !== null && availGB !== null) {
        result.memory_gb = `${usedGB.toFixed(1)} GB / ${(usedGB + availGB).toFixed(1)} GB`;
      }
    }
  }
}

function parseGPU(hw, result) {
  const loadCat = findChild(hw, 'Load');
  if (loadCat) {
    const gpuCore = findChild(loadCat, 'GPU Core');
    if (gpuCore) result.gpu_usage = parseVal(gpuCore.Value);
  }
  const tempCat = findChild(hw, 'Temperatures') || findChild(hw, 'Temperature');
  if (tempCat) {
    const gpuTemp = findChild(tempCat, 'GPU Core') ||
                    findChild(tempCat, 'GPU Hot Spot') ||
                    tempCat.Children?.[0];
    if (gpuTemp) result.gpu_temp = parseVal(gpuTemp.Value);
  }
  // VRAM: try SmallData first, then Data
  for (const catName of ['SmallData', 'Data']) {
    const cat = findChild(hw, catName);
    if (!cat) continue;
    const vramUsed = findChild(cat, 'GPU Memory Used');
    const vramTotal = findChild(cat, 'GPU Memory Total');
    const vramFree = findChild(cat, 'GPU Memory Free');
    if (vramUsed && vramTotal) {
      const usedMB = parseVal(vramUsed.Value);
      const totalMB = parseVal(vramTotal.Value);
      if (usedMB !== null && totalMB !== null && totalMB > 0) {
        result.vram_usage = (usedMB / totalMB) * 100;
        result.vram_gb = `${(usedMB / 1024).toFixed(1)} GB / ${(totalMB / 1024).toFixed(1)} GB`;
        break;
      }
    }
    if (!result.vram_gb && vramUsed && vramFree) {
      const usedMB = parseVal(vramUsed.Value);
      const freeMB = parseVal(vramFree.Value);
      if (usedMB !== null && freeMB !== null) {
        const totalMB = usedMB + freeMB;
        result.vram_usage = (usedMB / totalMB) * 100;
        result.vram_gb = `${(usedMB / 1024).toFixed(1)} GB / ${(totalMB / 1024).toFixed(1)} GB`;
        break;
      }
    }
  }
}

function parseNetSpeed(str) {
  if (!str) return null;
  const val = parseVal(str);
  if (val === null) return null;
  const lower = str.toLowerCase();
  if (lower.includes('kb/s') || lower.includes('kib/s')) return val * 1024;
  if (lower.includes('mb/s') || lower.includes('mib/s')) return val * 1024 * 1024;
  if (lower.includes('gb/s') || lower.includes('gib/s')) return val * 1024 * 1024 * 1024;
  return val; // B/s
}

function parseNetwork(hw, result) {
  const throughput = findChild(hw, 'Throughput');
  if (!throughput) return;
  const dl = findChild(throughput, 'Download Speed') ||
             findChild(throughput, 'Download') ||
             findChild(throughput, 'Received') ||
             findChild(throughput, 'Network Rx') ||
             findChild(throughput, 'Rx');
  const ul = findChild(throughput, 'Upload Speed') ||
             findChild(throughput, 'Upload') ||
             findChild(throughput, 'Sent') ||
             findChild(throughput, 'Network Tx') ||
             findChild(throughput, 'Tx');
  if (dl && result.download_speed === null) result.download_speed = parseNetSpeed(dl.Value);
  if (ul && result.upload_speed === null) result.upload_speed = parseNetSpeed(ul.Value);
}

function parseDisk(hw, result, index) {
  let diskStr = null;
  for (const catName of ['Data', 'SmallData']) {
    const cat = findChild(hw, catName);
    if (!cat) continue;
    const used = findChild(cat, 'Used Space');
    const free = findChild(cat, 'Free Space') || findChild(cat, 'Available Space');
    if (used && free) {
      const usedGB = parseVal(used.Value);
      const freeGB = parseVal(free.Value);
      if (usedGB !== null && freeGB !== null) {
        diskStr = `${usedGB.toFixed(0)} GB / ${(usedGB + freeGB).toFixed(0)} GB`;
        break;
      }
    }
  }
  if (!diskStr) {
    const loadCat = findChild(hw, 'Load');
    if (loadCat) {
      const activity = findChild(loadCat, 'Used Space') || findChild(loadCat, 'Total Activity');
      if (activity) {
        const pct = parseVal(activity.Value);
        if (pct !== null) diskStr = `${pct.toFixed(0)}%`;
      }
    }
  }
  if (index === 0 && diskStr) result.c_disk = diskStr;
  else if (index === 1 && diskStr) result.d_disk = diskStr;
}

export function isLHMData(data) {
  return data && typeof data === 'object' && Array.isArray(data.Children);
}

function hasSensorNamed(hw, name) {
  const lower = name.toLowerCase();
  return (hw.Children || []).some(cat =>
    (cat.Children || []).some(s => (s.Text || '').toLowerCase().includes(lower))
  );
}

function hasCategoryNamed(hw, name) {
  return !!(findChild(hw, name));
}

function sensorDetectCategory(hw) {
  if (hasCategoryNamed(hw, 'Throughput')) return 'network';
  if (hasSensorNamed(hw, 'CPU Total') || hasSensorNamed(hw, 'CPU Core #')) return 'cpu';
  if (hasSensorNamed(hw, 'GPU Core') && hasSensorNamed(hw, 'GPU Memory')) return 'gpu';
  if (hasSensorNamed(hw, 'Used Memory') || hasSensorNamed(hw, 'Available Memory')) return 'memory';
  if (hasSensorNamed(hw, 'Used Space') || hasSensorNamed(hw, 'Total Activity')) return 'disk';
  return null;
}

export function parseLHMData(root) {
  const computer = root?.Children?.[0];
  if (!computer) return null;

  const result = {
    cpu: null,
    cpu_temp: null,
    cpu_percore: [],
    gpu_usage: null,
    gpu_temp: null,
    memory: null,
    memory_gb: null,
    vram_usage: null,
    vram_gb: null,
    download_speed: null,
    upload_speed: null,
    c_disk: null,
    d_disk: null,
  };

  let diskIndex = 0;
  for (const hw of (computer.Children || [])) {
    // First try name-based detection, then fall back to sensor content detection
    const cat = hwCategory(hw.Text) || sensorDetectCategory(hw);
    if (cat === 'cpu') parseCPU(hw, result);
    else if (cat === 'memory') parseMemory(hw, result);
    else if (cat === 'gpu') parseGPU(hw, result);
    else if (cat === 'network') parseNetwork(hw, result);
    else if (cat === 'disk') parseDisk(hw, result, diskIndex++);
  }

  return { psutil: result, timestamp: Date.now() };
}
