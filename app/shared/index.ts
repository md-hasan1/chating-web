// App-level shared barrel — re-exports components, contexts and utils.
// These are shallow re-exports to provide a single import entry while
// transitioning the app structure. They intentionally duplicate exports
// from the original locations and can be removed after refactor.
export * from './components';
export * from './contexts';
export * from './utils';
