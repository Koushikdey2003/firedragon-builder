export class FDSearchEngineChild extends JSWindowActorChild {
    actorCreated() {
        const FDSearchEngine = Cu.createObjectIn(this.contentWindow, {
            defineAs: 'FDSearchEngine',
        });
        Cu.exportFunction(this.GetVisibleEngines.bind(this), FDSearchEngine, {
            defineAs: 'GetVisibleEngines',
        });
        Cu.exportFunction(this.GetDefaultEngine.bind(this), FDSearchEngine, {
            defineAs: 'GetDefaultEngine',
        });
        Cu.exportFunction(this.EngineOffersSuggestions.bind(this), FDSearchEngine, {
            defineAs: 'EngineOffersSuggestions',
        });
        Cu.exportFunction(this.FetchSuggestions.bind(this), FDSearchEngine, {
            defineAs: 'FetchSuggestions',
        });
        Cu.exportFunction(this.PerformSearch.bind(this), FDSearchEngine, {
            defineAs: 'PerformSearch',
        });
    }

    private exportPromise<T>(promise: Promise<T>): Promise<T> {
        return new this.contentWindow.Promise((resolve, reject) => {
            promise
                .then(value => {
                    resolve(Cu.cloneInto(value, this.contentWindow));
                })
                .catch(value => {
                    reject(Cu.cloneInto(value, this.contentWindow));
                });
        });
    }

    GetVisibleEngines() {
        return this.exportPromise(this.sendQuery('GetVisibleEngines'));
    }

    GetDefaultEngine() {
        return this.exportPromise(this.sendQuery('GetDefaultEngine'));
    }

    EngineOffersSuggestions(engineId: string) {
        return this.exportPromise(this.sendQuery('EngineOffersSuggestions', { engineId }));
    }

    FetchSuggestions(engineId: string, searchTerm: string) {
        return this.exportPromise(this.sendQuery('FetchSuggestions', { engineId, searchTerm }));
    }

    PerformSearch(engineId: string, searchTerm: string) {
        return this.exportPromise(this.sendQuery('PerformSearch', { engineId, searchTerm }));
    }
}
