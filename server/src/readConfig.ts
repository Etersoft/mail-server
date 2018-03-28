import * as lodash from 'lodash';
import { existsSync, readFileSync } from 'fs';


export function readConfig (): any {
  const baseConfig = require('../config.default.json');

  if (existsSync('../../server-config.json')) {
    const userConfig = require('../../server-config.json');
    return lodash.merge(baseConfig, userConfig);
  }

  return baseConfig;
}
