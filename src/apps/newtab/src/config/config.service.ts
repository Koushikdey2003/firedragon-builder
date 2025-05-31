import { effect, Injectable, signal } from "@angular/core";

import { rpc } from '../lib/rpc/rpc';
import { Config } from './interfaces';

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    pref = 'firedragon.newtab.config';

    defaultConfig: Config = {};

    config = signal<Config>(this.defaultConfig);

    constructor() {
        rpc.getStringPref(this.pref).then(config => {
            if (config) {
                this.config.set(JSON.parse(config));
            }
        });
        effect(() => {
            rpc.setStringPref(this.pref, JSON.stringify(this.config()));
        });
    }
}
