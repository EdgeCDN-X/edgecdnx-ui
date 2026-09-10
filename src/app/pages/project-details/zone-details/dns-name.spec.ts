import { dnsNameFromHost, hostFromDnsName, hostInputFromDnsName } from './dns-name';

describe('zone-relative DNS names', () => {
  it('maps an empty host to the zone apex', () => {
    expect(dnsNameFromHost('', 'example.com')).toBe('example.com');
    expect(hostFromDnsName('example.com', 'example.com')).toBe('@');
    expect(hostInputFromDnsName('example.com', 'example.com')).toBe('');
  });

  it('maps nested hosts relative to the zone', () => {
    expect(dnsNameFromHost('api.eu', 'example.com')).toBe('api.eu.example.com');
    expect(hostFromDnsName('api.eu.example.com', 'example.com')).toBe('api.eu');
  });

  it('handles trailing dots and case-insensitive zone matching', () => {
    expect(dnsNameFromHost('www.', 'example.com.')).toBe('www.example.com');
    expect(hostFromDnsName('WWW.Example.COM.', 'example.com')).toBe('WWW');
  });
});