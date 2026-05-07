import os from 'node:os'

function isIPv4(family) {
  return family === 'IPv4' || family === 4
}

export function getPrimaryLanIPv4() {
  const nets = os.networkInterfaces()
  const candidates = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (!isIPv4(net.family) || net.internal) continue
      const a = net.address
      if (a.startsWith('169.254.')) continue
      candidates.push(a)
    }
  }
  return (
    candidates.find((a) => a.startsWith('192.168.')) ??
    candidates.find((a) => a.startsWith('10.')) ??
    candidates.find((a) => /^172\.(1[6-9]|2[0-9]|3[01])\./.test(a)) ??
    candidates[0]
  )
}
