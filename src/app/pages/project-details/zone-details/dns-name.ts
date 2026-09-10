function withoutTrailingDot(value: string): string {
  return value.trim().replace(/\.$/, '');
}

export function dnsNameFromHost(host: string, zoneName: string): string {
  const normalizedHost = withoutTrailingDot(host);
  const normalizedZone = withoutTrailingDot(zoneName);

  return normalizedHost ? `${normalizedHost}.${normalizedZone}` : normalizedZone;
}

export function hostFromDnsName(dnsName: string, zoneName: string): string {
  const normalizedDnsName = withoutTrailingDot(dnsName);
  const normalizedZone = withoutTrailingDot(zoneName);

  if (normalizedDnsName.toLowerCase() === normalizedZone.toLowerCase()) {
    return '@';
  }

  const suffix = `.${normalizedZone}`;
  if (normalizedDnsName.toLowerCase().endsWith(suffix.toLowerCase())) {
    return normalizedDnsName.slice(0, -suffix.length);
  }

  return normalizedDnsName;
}

export function hostInputFromDnsName(dnsName: string, zoneName: string): string {
  const host = hostFromDnsName(dnsName, zoneName);
  return host === '@' ? '' : host;
}