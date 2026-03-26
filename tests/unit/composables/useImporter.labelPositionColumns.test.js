import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseStrictExcelProject } from '@/composables/useImporter.js';

function appendSheet(workbook, name, rows) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
}

describe('useImporter label position columns', () => {
  it('parses extended label position columns for casing, horizons, and callouts', () => {
    const workbook = XLSX.utils.book_new();

    appendSheet(workbook, 'Casing', [
      [
        'Label',
        'OD',
        'Weight',
        'Grade',
        'Top',
        'Bottom',
        'TOC',
        'BOC',
        'ID Override',
        'Hole Size',
        'Label X',
        'Label Depth',
        'Directional Label X',
        'Directional Label Depth',
        'Casing Label Font Size',
        'Depth Label Font Size',
        'Depth Label X Offset',
        'Top Label X',
        'Top Label Depth',
        'Bottom Label X',
        'Bottom Label Depth',
        'Directional Top Label X',
        'Directional Top Label Depth',
        'Directional Bottom Label X',
        'Directional Bottom Label Depth',
        'Show Top',
        'Show Bottom'
      ],
      [
        'Surface',
        9.625,
        40,
        'L80',
        0,
        5000,
        '',
        '',
        '',
        '',
        -0.8,
        2500,
        0.3,
        2600,
        11,
        9,
        35,
        -0.6,
        125,
        -0.55,
        4900,
        0.45,
        150,
        0.4,
        4850,
        true,
        true
      ]
    ]);

    appendSheet(workbook, 'Horizons', [
      [
        'Depth',
        'Directional Depth Mode',
        'Directional Depth MD',
        'Directional Depth TVD',
        'Label',
        'Color',
        'Font Color',
        'Font Size',
        'Line Style',
        'Label X',
        'Label Depth',
        'Directional Label X',
        'Directional Label Depth',
        'Show'
      ],
      [2500, 'MD', 2500, 2400, 'Landing', 'steelblue', 'steelblue', 11, 'Solid', 0.6, 2550, 0.25, 2525, true]
    ]);

    appendSheet(workbook, 'Callouts', [
      [
        'Top',
        'Bottom',
        'Label',
        'Detail',
        'Color',
        'Font Color',
        'Font Size',
        'Label X',
        'Label Depth',
        'Directional Label X',
        'Directional Label Depth',
        'Band Width',
        'Opacity',
        'Show Details',
        'Show'
      ],
      [1000, 1800, 'Zone', 'Notes', 'lightsteelblue', 'steelblue', 12, -0.4, 1450, -0.2, 1500, 1.0, 0.35, true, true]
    ]);

    const fileBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const parsed = parseStrictExcelProject(fileBuffer);

    expect(parsed.casingData[0]).toMatchObject({
      labelXPos: -0.8,
      manualLabelDepth: 2500,
      directionalLabelXPos: 0.3,
      directionalManualLabelDepth: 2600,
      topLabelXPos: -0.6,
      topManualLabelDepth: 125,
      bottomLabelXPos: -0.55,
      bottomManualLabelDepth: 4900,
      directionalTopLabelXPos: 0.45,
      directionalTopManualLabelDepth: 150,
      directionalBottomLabelXPos: 0.4,
      directionalBottomManualLabelDepth: 4850
    });

    expect(parsed.horizontalLines[0]).toMatchObject({
      directionalDepthMode: 'md',
      directionalDepthMd: 2500,
      directionalDepthTvd: 2400,
      labelXPos: 0.6,
      manualLabelDepth: 2550,
      directionalLabelXPos: 0.25,
      directionalManualLabelDepth: 2525
    });

    expect(parsed.annotationBoxes[0]).toMatchObject({
      labelXPos: -0.4,
      manualLabelDepth: 1450,
      directionalLabelXPos: -0.2,
      directionalManualLabelDepth: 1500
    });
  });
});
