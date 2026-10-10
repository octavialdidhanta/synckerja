import { describe, expect, it } from 'vitest';
import { countCategoryDistribution } from './useCategoryDistribution';

const services = [
  { id: 'cat-a', name: 'Alpha' },
  { id: 'cat-b', name: 'Beta' },
];
const subServices = [
  { id: 'sub-a1', name: 'Alpha One', service_id: 'cat-a', image_path: 'org/sub-a1.jpg' },
  { id: 'sub-b1', name: 'Beta One', service_id: 'cat-b', image_path: '  ' },
];

describe('countCategoryDistribution', () => {
  it('uses every content row in the selected month as the percentage base', () => {
    const result = countCategoryDistribution({
      selectedMonth: new Date(2026, 9, 15),
      services,
      subServices,
      plans: [
        { id: '1', service_id: 'cat-a', sub_service_id: 'sub-a1', post_date: '2026-10-01' },
        { id: '1', service_id: 'cat-a', sub_service_id: 'sub-a1', post_date: '2026-10-01' },
        { id: '2', service_id: 'cat-a', sub_service_id: 'sub-a1', post_date: '2026-10-31T10:00:00' },
        { id: '3', service_id: 'cat-b', sub_service_id: 'sub-b1', post_date: '2026-08-15T12:00:00' },
        { id: '4', service_id: null, sub_service_id: null, post_date: '2026-10-10' },
        { id: '5', service_id: 'cat-a', sub_service_id: null, post_date: '2026-10-02' },
      ],
    });

    expect(result.total).toBe(4);
    expect(result.categories.map((item) => [item.name, item.count, item.percentage])).toEqual([
      ['Alpha', 3, 75],
      ['Beta', 0, 0],
    ]);
    expect(result.subCategories.find((item) => item.id === 'sub-a1')).toMatchObject({
      count: 2,
      imagePath: 'org/sub-a1.jpg',
    });
    expect(result.subCategories.find((item) => item.id === 'sub-b1')).toMatchObject({
      count: 0,
      imagePath: null,
    });
  });

  it('applies the same service filter as the pillar tracker', () => {
    const result = countCategoryDistribution({
      selectedMonth: new Date(2026, 9, 1),
      serviceFilter: 'cat-b',
      services,
      subServices,
      plans: [
        { service_id: 'cat-a', sub_service_id: 'sub-a1', post_date: '2026-10-04' },
        { service_id: 'cat-b', sub_service_id: 'sub-b1', post_date: '2026-10-04' },
      ],
    });

    expect(result.total).toBe(1);
    expect(result.categories[0]).toMatchObject({ id: 'cat-b', count: 1, percentage: 100 });
  });

  it('keeps sub category features visible when the selected month has no content for them', () => {
    const result = countCategoryDistribution({
      selectedMonth: new Date(2026, 9, 15),
      services,
      subServices,
      features: [
        {
          id: 'feat-1',
          feature_name: 'GaN 45W',
          service_id: 'cat-a',
          sub_service_id: 'sub-a1',
          feature_description: 'Fast charge',
          solution: 'Use GaN',
          competitive_advantage: 'Smaller',
        },
        { id: 'feat-2', feature_name: 'Cable included', service_id: 'cat-b', sub_service_id: 'sub-b1' },
        { id: 'feat-3', feature_name: 'Unused port', service_id: 'cat-a', sub_service_id: 'sub-a1' },
      ],
      plans: [
        { id: '1', service_id: 'cat-a', sub_service_id: 'sub-a1', feature_id: 'feat-1', post_date: '2026-10-05T12:00:00' },
        { id: '2', service_id: 'cat-a', sub_service_id: 'sub-a1', feature_id: 'feat-1', post_date: '2026-10-06T12:00:00' },
        { id: '3', service_id: 'cat-a', sub_service_id: 'sub-a1', feature_id: 'feat-3', post_date: '2026-08-15T12:00:00' },
        { id: '4', service_id: 'cat-a', sub_service_id: 'sub-a1', feature_id: null, post_date: '2026-10-07T12:00:00' },
        { id: '5', service_id: 'cat-b', sub_service_id: 'sub-b1', feature_id: 'feat-2', post_date: '2026-10-08T12:00:00' },
      ],
    });

    expect(result.features).toEqual([
      {
        id: 'feat-1',
        name: 'GaN 45W',
        subServiceId: 'sub-a1',
        count: 2,
        feature_description: 'Fast charge',
        solution: 'Use GaN',
        competitive_advantage: 'Smaller',
      },
      {
        id: 'feat-2',
        name: 'Cable included',
        subServiceId: 'sub-b1',
        count: 1,
        feature_description: null,
        solution: null,
        competitive_advantage: null,
      },
      {
        id: 'feat-3',
        name: 'Unused port',
        subServiceId: 'sub-a1',
        count: 0,
        feature_description: null,
        solution: null,
        competitive_advantage: null,
      },
    ]);
  });
});
