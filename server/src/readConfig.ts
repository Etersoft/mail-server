import * as lodash from 'lodash';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';


export function readConfig (): any {
  const baseConfig = require('../../config.default.json');

  if (existsSync(join(__dirname, '..', '..', 'config.json'))) {
    const userConfig = require('../../config.json');
    return lodash.merge(baseConfig, userConfig);
  }

  return baseConfig;
}
