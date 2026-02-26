import { getExportsModule } from './runtime/context.js';

const delegate = async (methodName, ...args) => {
    const exportsModule = await getExportsModule();
    return exportsModule[methodName](...args);
};
// This module provides delegated export and download workflow functions.
const downloadExcelTemplate = () => delegate('downloadExcelTemplate');
const downloadEditedWorkbook = (options = {}) => delegate('downloadEditedWorkbook', options);
const downloadPNG = (scale = 3) => delegate('downloadPNG', scale);
const downloadJPEG = (quality = 0.95) => delegate('downloadJPEG', quality);
const downloadWebP = (quality = 0.9) => delegate('downloadWebP', quality);
const downloadSVG = () => delegate('downloadSVG');
const saveProjectFile = () => delegate('saveProjectFile');
const saveProjectFileAs = () => delegate('saveProjectFileAs');
const saveActiveWellProjectFile = () => delegate('saveActiveWellProjectFile');

export {
    downloadEditedWorkbook,
    downloadExcelTemplate,
    downloadJPEG,
    downloadPNG,
    downloadSVG,
    downloadWebP,
    saveActiveWellProjectFile,
    saveProjectFileAs,
    saveProjectFile
};
