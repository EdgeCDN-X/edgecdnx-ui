import { FormArray, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { CacheConfig, GeoLookupAttribute, PrometheusAlertMatcher } from '../../admin/store/admin.types';
import { LocationNode, LocationNodeGroup, ProjectLocation, UpdateLocationDto } from '../../projects/store/location.types';
import { HealthCheckProfile } from '../../projects/store/healthcheckprofile.types';

export function projectHealthCheckProfileNames(profiles: readonly HealthCheckProfile[], projectId: string): string[] {
  if (!projectId) return [];
  return profiles
    .filter((profile) => profile.metadata.labels?.[tenantLabelKey] === projectId)
    .map((profile) => profile.metadata.name)
    .sort((first, second) => first.localeCompare(second));
}

export function healthCheckProfileValidator(availableNames: readonly string[]): ValidatorFn {
  return (control) => !control.value || availableNames.includes(control.value) ? null : { unavailable: true };
}

const integer: ValidatorFn = (control) => Number.isInteger(control.value) ? null : { integer: true };
const nameValidators = [Validators.required, Validators.maxLength(253), Validators.pattern(/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*$/)];
const text = (value = '', validators: ValidatorFn[] = []) => new FormControl(value, { nonNullable: true, validators });
export const fallbackForm = (value = '', availableNames?: readonly string[]) => text(value, [
  ...nameValidators,
  ...(availableNames === undefined ? [] : [((control) =>
    !control.value || availableNames.includes(control.value) ? null : { unavailable: true }) as ValidatorFn]),
]);
const weight = (value = 0) => new FormControl(value, { nonNullable: true, validators: [Validators.required, integer] });

export function projectFallbackLocationNames(locations: readonly ProjectLocation[], projectId: string, currentName?: string): string[] {
  if (!projectId) return [];
  return locations
    .filter((location) => location.metadata.labels?.['edgecdnx.com/tenant'] === projectId && location.metadata.name !== currentName)
    .map((location) => location.metadata.name)
    .sort((first, second) => first.localeCompare(second));
}

export const geoLookupAttributes = [
  { name: 'geoip/city/name', label: 'City (geoip/city/name)', weight: 10 },
  { name: 'geoip/country/code', label: 'Country (geoip/country/code)', weight: 100 },
  { name: 'geoip/continent/code', label: 'Continent (geoip/continent/code)', weight: 1000 },
] as const;

export const continentCodes = ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'] as const;

function attributeValueValidators(attributeName: string): ValidatorFn[] {
  const validators = [Validators.required, Validators.pattern(/\S/)];
  if (attributeName === 'geoip/country/code') validators.push(Validators.pattern(/^[A-Z]{2}$/));
  if (attributeName === 'geoip/continent/code') validators.push(Validators.pattern(/^(AF|AN|AS|EU|NA|OC|SA)$/));
  return validators;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const stringMap = (value: unknown): boolean => record(value) && Object.values(value).every((item) => typeof item === 'string');
const alerts = (value: unknown): boolean => Array.isArray(value) && value.every((item: unknown) =>
  record(item) && typeof item['alertName'] === 'string' && item['alertName'].trim() !== '' &&
  (item['labels'] === undefined || stringMap(item['labels'])));
const cache = (value: unknown): boolean => record(value) &&
  ['path', 'keysZone', 'inactive', 'maxSize'].every((key) => typeof value[key] === 'string') &&
  (value['name'] === undefined || typeof value['name'] === 'string');

function jsonValidator(check: (value: unknown) => boolean): ValidatorFn {
  return (control) => {
    if (!control.value?.trim()) return null;
    try {
      const value: unknown = JSON.parse(control.value);
      return check(value) ? null : { json: true };
    } catch {
      return { json: true };
    }
  };
}

const jsonText = (value: unknown, check: (value: unknown) => boolean) =>
  text(value === undefined ? '' : JSON.stringify(value, null, 2), [jsonValidator(check)]);

function unique(keys: string[]): ValidatorFn {
  return (control) => {
    const items = control.value as Record<string, unknown>[];
    const values = items.map((item) => JSON.stringify(keys.map((key) => item[key])));
    return new Set(values).size === values.length ? null : { duplicate: true };
  };
}

export function keyValueForm(key = '', value = '') {
  return new FormGroup({
    key: text(key, [Validators.required, Validators.pattern(/\S/)]),
    value: text(value),
  });
}

function keyValueMapForm(value: Record<string, string> = {}) {
  return new FormArray(Object.entries(value).map(([key, value]) => keyValueForm(key, value)), unique(['key']));
}

export const tenantLabelKey = 'edgecdnx.com/tenant';
const labelName = /^([A-Za-z0-9]([-A-Za-z0-9_.]{0,61}[A-Za-z0-9])?)$/;
const labelPrefix = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

function validLabelKey(key: string): boolean {
  const parts = key.split('/');
  if (parts.length > 2) return false;
  const name = parts.pop()!;
  const prefix = parts[0];
  return labelName.test(name) && (prefix === undefined || (prefix.length <= 253 && labelPrefix.test(prefix)));
}

const resourceLabelsValidator: ValidatorFn = (control) => {
  const rows = control.value as { key: string; value: string }[];
  if (rows.some((row) => row.key === tenantLabelKey)) return { reserved: true };
  const invalid = rows.some((row) => row.key && (!validLabelKey(row.key) || (row.value !== '' && !labelName.test(row.value))));
  return invalid ? { labelFormat: true } : null;
};

export function resourceLabelsForm(labels: Record<string, string> = {}) {
  const rows = Object.entries(labels).filter(([key]) => key !== tenantLabelKey).map(([key, value]) => keyValueForm(key, value));
  return new FormArray(rows, [unique(['key']), resourceLabelsValidator]);
}

export function nodeForm(node?: LocationNode) {
  return new FormGroup({
    name: text(node?.name, [Validators.required]),
    ipv4: text(node?.ipv4),
    ipv6: text(node?.ipv6),
    maintenanceMode: new FormControl(node?.maintenanceMode ?? false, { nonNullable: true }),
    healthCheck: text(node?.healthCheck?.name),
    caches: jsonText(node?.caches, (value) => Array.isArray(value) && value.every((item: unknown) => typeof item === 'string')),
    alerts: jsonText(node?.alerts, alerts),
  });
}

export function nodeGroupForm(group?: LocationNodeGroup) {
  return new FormGroup({
    name: text(group?.name, [Validators.required]),
    flavor: text(group?.flavor ?? ''),
    labels: keyValueMapForm(group?.labels),
    metadata: keyValueMapForm(group?.metadata),
    nodeSelector: jsonText(group?.nodeSelector, stringMap),
    healthCheck: text(group?.healthCheck?.name),
    cacheConfig: jsonText(group?.cacheConfig, cache),
    nodes: new FormArray((group?.nodes ?? []).map(nodeForm), unique(['name'])),
  });
}

export function attributeValueForm(value = '', valueWeight = 0, attributeName = '') {
  return new FormGroup({ value: text(value, attributeValueValidators(attributeName)), weight: weight(valueWeight) });
}

export function attributeForm(name = '', attribute?: GeoLookupAttribute) {
  return new FormGroup({
    name: text(name, [Validators.required]),
    weight: weight(attribute?.weight ?? geoLookupAttributes.find((option) => option.name === name)?.weight ?? 0),
    values: new FormArray((attribute?.values ?? []).map((item) => attributeValueForm(item.value, item.weight, name))),
  });
}

export function selectGeoLookupAttribute(attribute: ReturnType<typeof attributeForm>, name: string): void {
  const option = geoLookupAttributes.find((item) => item.name === name);
  if (!option) return;
  attribute.controls.name.setValue(option.name);
  attribute.controls.weight.setValue(option.weight);
  for (const value of attribute.controls.values.controls) {
    value.controls.value.setValidators(attributeValueValidators(option.name));
    value.controls.value.updateValueAndValidity();
  }
}

export function createLocationForm(location?: ProjectLocation) {
  return new FormGroup({
    name: text(location?.metadata.name, nameValidators),
    labels: resourceLabelsForm(location?.metadata.labels),
    weight: new FormControl(location?.spec?.weight ?? 0, {
      nonNullable: true,
      validators: [Validators.required, integer, Validators.min(-2147483648), Validators.max(2147483647)],
    }),
    geoWeight: new FormControl(location?.spec?.geoLookup?.weight ?? 0, {
      nonNullable: true,
      validators: [Validators.required, integer, Validators.min(0), Validators.max(1000)],
    }),
    fallbackLocations: new FormArray((location?.spec?.fallbackLocations ?? []).map((name) => fallbackForm(name)), (control) => {
      const names = control.value as string[];
      return new Set(names).size === names.length ? null : { duplicate: true };
    }),
    nodeGroups: new FormArray((location?.spec?.nodeGroups ?? []).map(nodeGroupForm), unique(['name', 'flavor'])),
    attributes: new FormArray(Object.entries(location?.spec?.geoLookup?.attributes ?? {}).map(([name, attribute]) => attributeForm(name, attribute)), unique(['name'])),
  });
}

function parse<T>(value: string): T | undefined {
  return value.trim() ? JSON.parse(value) as T : undefined;
}

export function locationDtoFromForm(form: ReturnType<typeof createLocationForm>, projectId: string): UpdateLocationDto {
  if (form.invalid) throw new Error('Check the highlighted fields.');
  const value = form.getRawValue();
  return {
    labels: Object.fromEntries(value.labels.map(({ key, value }) => [key, value])),
    weight: value.weight,
    fallbackLocations: value.fallbackLocations,
    geoLookup: {
      weight: value.geoWeight,
      attributes: Object.fromEntries(value.attributes.map((attribute) => [attribute.name, {
        weight: attribute.weight,
        values: attribute.values,
      }])),
    },
    nodeGroups: value.nodeGroups.map((group) => {
      const labels = Object.fromEntries(group.labels.map(({ key, value }) => [key, value]));
      if (labels?.['edgecdnx.com/tenant'] !== undefined && labels['edgecdnx.com/tenant'] !== projectId) {
        throw new Error('Node group tenant labels must match the selected project.');
      }
      return {
        name: group.name,
        flavor: group.flavor,
        labels,
        metadata: Object.fromEntries(group.metadata.map(({ key, value }) => [key, value])),
        nodeSelector: parse<Record<string, string>>(group.nodeSelector),
        healthCheck: group.healthCheck ? { name: group.healthCheck } : undefined,
        cacheConfig: parse<CacheConfig>(group.cacheConfig),
        nodes: group.nodes.map((node) => ({
          name: node.name,
          ipv4: node.ipv4 || undefined,
          ipv6: node.ipv6 || undefined,
          maintenanceMode: node.maintenanceMode,
          healthCheck: node.healthCheck ? { name: node.healthCheck } : undefined,
          caches: parse<string[]>(node.caches),
          alerts: parse<PrometheusAlertMatcher[]>(node.alerts),
        })),
      };
    }),
  };
}