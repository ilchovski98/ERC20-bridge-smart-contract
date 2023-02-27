const lazyImport = async (module: any) => {
  return await import(module);
};

export default lazyImport;
