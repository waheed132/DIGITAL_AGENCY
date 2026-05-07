import { getPrimaryLanIPv4 } from '../dev/lanIpv4.mjs'

const port = process.argv[2] || '5173'
const ip = getPrimaryLanIPv4()
if (!ip) {
  console.error('No LAN IPv4 found. Connect Wi‑Fi / Ethernet, then try again.')
  process.exit(1)
}
console.log('http://' + ip + ':' + port + '/')
