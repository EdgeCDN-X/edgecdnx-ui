import { ProjectLocation } from '../../projects/store/location.types';
import { attributeForm, attributeValueForm, createLocationForm, fallbackForm, keyValueForm, locationDtoFromForm, nodeForm, nodeGroupForm, projectFallbackLocationNames, resourceLabelsForm, selectGeoLookupAttribute } from './location-form.model';

describe('Location form DTOs', () => {
  it('loads resource labels without the managed project label and serializes edits', () => {
    const form = createLocationForm({
      metadata: { name: 'fra1', labels: { 'project': 'project-a', 'edgecdnx.com/route-kind': 'static' } },
    });
    expect(form.controls.labels.length).toBe(1);
    form.controls.labels.push(keyValueForm('region', 'eu'));
    expect(locationDtoFromForm(form, 'project-a').labels).toEqual({ 'edgecdnx.com/route-kind': 'static', region: 'eu' });
    form.controls.labels.clear();
    expect(locationDtoFromForm(form, 'project-a').labels).toEqual({});
  });

  it('rejects the reserved project key and invalid Kubernetes label keys or values', () => {
    const labels = resourceLabelsForm();
    labels.push(keyValueForm('project', 'project-b'));
    expect(labels.hasError('reserved')).toBeTrue();
    labels.at(0).controls.key.setValue('edgecdnx.com/route-kind');
    expect(labels.valid).toBeTrue();
    for (const [key, value] of [['invalid key', 'x'], ['a/b/c', 'x'], ['Bad_Prefix/name', 'x'], ['region', 'not valid!'], ['region', 'x'.repeat(64)]]) {
      labels.at(0).controls.key.setValue(key);
      labels.at(0).controls.value.setValue(value);
      expect(labels.hasError('labelFormat')).withContext(`${key}=${value}`).toBeTrue();
    }
    labels.at(0).controls.value.setValue('');
    labels.at(0).controls.key.setValue('region');
    expect(labels.valid).toBeTrue();
  });
  it('offers only existing locations with the exact project label, excluding itself', () => {
    const locations: ProjectLocation[] = [
      { metadata: { name: 'fra1', labels: { 'project': 'project-a' } } },
      { metadata: { name: 'ams1', labels: { 'project': 'project-a' } } },
      { metadata: { name: 'foreign', labels: { 'project': 'project-b' } } },
      { metadata: { name: 'shared', labels: { 'project': 'global' } } },
      { metadata: { name: 'unowned' } },
    ];
    expect(projectFallbackLocationNames(locations, 'project-a')).toEqual(['ams1', 'fra1']);
    expect(projectFallbackLocationNames(locations, 'project-a', 'fra1')).toEqual(['ams1']);
    expect(projectFallbackLocationNames(locations, 'project-b')).toEqual(['foreign']);
    expect(projectFallbackLocationNames(locations, '')).toEqual([]);
  });

  it('accepts available fallback references and rejects missing or foreign references', () => {
    const fallback = fallbackForm('ams1', ['ams1']);
    expect(fallback.valid).toBeTrue();
    fallback.setValue('foreign');
    expect(fallback.hasError('unavailable')).toBeTrue();
    fallback.setValue('missing');
    expect(fallback.hasError('unavailable')).toBeTrue();
    fallback.setValue('');
    expect(fallback.hasError('required')).toBeTrue();
  });

  it('prefills editable weights for each supported geolookup attribute', () => {
    for (const [name, defaultWeight] of [
      ['default', 1],
      ['geoip/city/name', 10], ['geoip/country/code', 100], ['geoip/continent/code', 1000],
    ] as const) {
      const attribute = attributeForm();
      selectGeoLookupAttribute(attribute, name);
      expect(attribute.controls.name.value).toBe(name);
      expect(attribute.controls.weight.value).toBe(defaultWeight);
      attribute.controls.weight.setValue(42);
      expect(attribute.controls.weight.value).toBe(42);
    }
  });

  it('preserves saved custom and zero weights when editing', () => {
    expect(attributeForm('default').controls.weight.value).toBe(1);
    expect(attributeForm('default', { weight: 8, values: [{ value: 'ignored', weight: 2 }] }).controls.values.length).toBe(0);
    expect(attributeForm('geoip/city/name').controls.weight.value).toBe(10);
    expect(attributeForm('geoip/country/code', { weight: 37 }).controls.weight.value).toBe(37);
    expect(attributeForm('geoip/continent/code', { weight: 0 }).controls.weight.value).toBe(0);
  });

  it('updates defaults and value validation when switching attributes', () => {
    const attribute = attributeForm('geoip/city/name', { weight: 25, values: [{ value: 'Berlin' }] });
    selectGeoLookupAttribute(attribute, 'geoip/country/code');
    expect(attribute.controls.weight.value).toBe(100);
    const value = attribute.controls.values.at(0).controls.value;
    expect(value.invalid).toBeTrue();
    value.setValue('DE');
    expect(value.valid).toBeTrue();
    value.setValue('de');
    expect(value.invalid).toBeTrue();
    selectGeoLookupAttribute(attribute, 'geoip/continent/code');
    expect(attribute.controls.weight.value).toBe(1000);
    expect(value.invalid).toBeTrue();
    for (const code of ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA']) {
      value.setValue(code);
      expect(value.valid).withContext(code).toBeTrue();
    }
    selectGeoLookupAttribute(attribute, 'default');
    expect(attribute.controls.weight.value).toBe(1);
    expect(attribute.controls.values.length).toBe(0);
    selectGeoLookupAttribute(attribute, 'geoip/city/name');
    expect(attribute.controls.values.length).toBe(0);
  });

  it('omits specific values when serializing the default attribute', () => {
    const form = createLocationForm();
    form.controls.name.setValue('fra1');
    form.controls.attributes.push(attributeForm('default'));
    expect(locationDtoFromForm(form, 'project-a').geoLookup.attributes?.['default']).toEqual({ weight: 1 });
  });

  const location: ProjectLocation = {
    metadata: { name: 'fra1' },
    spec: {
      weight: 75,
      fallbackLocations: ['ams1'],
      geoLookup: { weight: 100, attributes: { country: { weight: 50, values: [{ value: 'DE', weight: 20 }] } } },
      nodeGroups: [{
        name: 'nginx', flavor: 'standard',
        labels: { region: 'eu', 'project': 'project-a' },
        metadata: { maxSize: '10g' }, nodeSelector: { arch: 'amd64' },
        healthCheck: { name: 'group-health' },
        cacheConfig: { name: 'cache', path: '/cache', keysZone: 'cache', inactive: '1h', maxSize: '10g' },
        nodes: [{
          name: 'cache-1', ipv4: '192.0.2.1', ipv6: '2001:db8::1', maintenanceMode: true,
          healthCheck: { name: 'node-health' }, caches: ['cache'],
          alerts: [{ alertName: 'CacheDown', labels: { severity: 'critical' } }],
        }],
      }],
    },
  };

  it('round-trips every editable field including nested optional configuration', () => {
    const form = createLocationForm(location);
    expect(form.valid).toBeTrue();
    expect(locationDtoFromForm(form, 'project-a')).toEqual({ ...location.spec!, labels: {} } as ReturnType<typeof locationDtoFromForm>);
  });

  it('defaults new node groups to an empty flavor without requiring user input', () => {
    const form = createLocationForm();
    form.controls.name.setValue('fra1');
    const group = nodeGroupForm();
    group.controls.name.setValue('nginx');
    form.controls.nodeGroups.push(group);
    expect(form.valid).toBeTrue();
    expect(locationDtoFromForm(form, 'project-a').nodeGroups[0].flavor).toBe('');
  });

  it('preserves stored flavors on edit and rejects duplicate default-flavor groups', () => {
    const form = createLocationForm(location);
    expect(locationDtoFromForm(form, 'project-a').nodeGroups[0].flavor).toBe('standard');
    const group = nodeGroupForm();
    group.controls.name.setValue('nginx');
    form.controls.nodeGroups.push(group);
    expect(form.controls.nodeGroups.valid).toBeTrue();
    const duplicate = nodeGroupForm();
    duplicate.controls.name.setValue('nginx');
    form.controls.nodeGroups.push(duplicate);
    expect(form.controls.nodeGroups.hasError('duplicate')).toBeTrue();
  });

  it('serializes explicitly cleared settings and zero weights', () => {
    const form = createLocationForm(location);
    form.controls.weight.setValue(0);
    form.controls.geoWeight.setValue(0);
    form.controls.nodeGroups.clear();
    form.controls.attributes.clear();
    form.controls.fallbackLocations.clear();
    expect(locationDtoFromForm(form, 'project-a')).toEqual({
      labels: {}, weight: 0, geoLookup: { weight: 0, attributes: {} }, nodeGroups: [], fallbackLocations: [],
    });
  });

  it('builds nested create settings using repeatable controls', () => {
    const form = createLocationForm();
    form.controls.name.setValue('fra1');
    const group = nodeGroupForm({ name: 'nginx', flavor: 'standard' });
    group.controls.nodes.push(nodeForm({ name: 'cache-1', ipv4: '192.0.2.1' }));
    form.controls.nodeGroups.push(group);
    const attribute = attributeForm('country');
    attribute.controls.values.push(attributeValueForm('DE', 20));
    form.controls.attributes.push(attribute);
    const dto = locationDtoFromForm(form, 'project-a');
    expect(dto.nodeGroups[0].nodes?.[0].name).toBe('cache-1');
    expect(dto.geoLookup.attributes?.['country'].values?.[0]).toEqual({ value: 'DE', weight: 20 });
  });

  it('rejects missing names, fractional weights and out-of-range geolookup weights', () => {
    const form = createLocationForm();
    expect(form.invalid).toBeTrue();
    form.controls.name.setValue('Invalid_Name');
    expect(form.controls.name.invalid).toBeTrue();
    form.controls.name.setValue('invalid..name');
    expect(form.controls.name.invalid).toBeTrue();
    form.controls.name.setValue('fra1');
    form.controls.weight.setValue(1.5);
    expect(form.controls.weight.invalid).toBeTrue();
    form.controls.geoWeight.setValue(1001);
    expect(form.controls.geoWeight.invalid).toBeTrue();
  });

  it('rejects duplicate groups, nodes and attributes', () => {
    const form = createLocationForm(location);
    form.controls.nodeGroups.push(nodeGroupForm(location.spec?.nodeGroups?.[0]));
    expect(form.controls.nodeGroups.hasError('duplicate')).toBeTrue();
    const nodes = form.controls.nodeGroups.at(0).controls.nodes;
    nodes.push(nodeForm({ name: 'cache-1' }));
    expect(nodes.hasError('duplicate')).toBeTrue();
    form.controls.attributes.push(attributeForm('country'));
    expect(form.controls.attributes.hasError('duplicate')).toBeTrue();
  });

  it('validates the shape of JSON selector, alert and cache configuration', () => {
    const group = nodeGroupForm();
    for (const value of ['{', '[]', '{"key":10}', 'null']) {
      group.controls.nodeSelector.setValue(value);
      expect(group.controls.nodeSelector.invalid).withContext(value).toBeTrue();
    }
    group.controls.nodeSelector.setValue('{"region":"eu"}');
    expect(group.controls.nodeSelector.valid).toBeTrue();
    group.controls.cacheConfig.setValue('{}');
    expect(group.controls.cacheConfig.invalid).toBeTrue();
    const node = nodeForm();
    node.controls.alerts.setValue('[{"alertName":""}]');
    expect(node.controls.alerts.invalid).toBeTrue();
  });

  it('rejects attempts to override the project through node-group labels', () => {
    const form = createLocationForm(location);
    const projectLabel = form.controls.nodeGroups.at(0).controls.labels.controls.find((row) => row.controls.key.value === 'project');
    projectLabel!.controls.value.setValue('project-b');
    expect(() => locationDtoFromForm(form, 'project-a')).toThrowError(/project labels/);
  });

  it('adds and removes label and metadata rows while preserving empty values', () => {
    const form = createLocationForm(location);
    const group = form.controls.nodeGroups.at(0);
    group.controls.labels.push(keyValueForm('optional', ''));
    group.controls.labels.removeAt(0);
    group.controls.metadata.push(keyValueForm('inactive', '1h'));
    const dto = locationDtoFromForm(form, 'project-a');
    expect(dto.nodeGroups[0].labels).toEqual({ 'project': 'project-a', optional: '' });
    expect(dto.nodeGroups[0].metadata).toEqual({ maxSize: '10g', inactive: '1h' });
    group.controls.labels.clear();
    group.controls.metadata.clear();
    const cleared = locationDtoFromForm(form, 'project-a');
    expect(cleared.nodeGroups[0].labels).toEqual({});
    expect(cleared.nodeGroups[0].metadata).toEqual({});
  });

  it('rejects missing and duplicate keys for both builders', () => {
    const group = nodeGroupForm({ name: 'nginx', flavor: 'standard' });
    for (const rows of [group.controls.labels, group.controls.metadata]) {
      rows.push(keyValueForm('', 'value'));
      expect(rows.invalid).toBeTrue();
      rows.at(0).controls.key.setValue('   ');
      expect(rows.invalid).toBeTrue();
      rows.at(0).controls.key.setValue('region');
      expect(rows.valid).toBeTrue();
      rows.push(keyValueForm('region', 'eu'));
      expect(rows.hasError('duplicate')).toBeTrue();
    }
  });
});