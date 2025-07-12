// Async test file for analyzer tests
export async function asyncMain(): Promise<void> {
  await asyncFunction1();
  await asyncFunction2();
}

async function asyncFunction1(): Promise<string> {
  return new Promise(resolve => {
    setTimeout(() => resolve('async 1'), 100);
  });
}

async function asyncFunction2(): Promise<number> {
  const result = await asyncFunction1();
  return result.length;
}