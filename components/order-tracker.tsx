import { ORDER_STAGES, stageIndex, stageProgress } from "@/lib/order-stages";

/**
 * Pizza-tracker style progress: horizontal on sm+ screens, vertical on phones.
 * The current stage pulses and the bar fills; both stop under reduced motion.
 */
export function OrderTracker({ stage, frozen = false }: { stage: string; frozen?: boolean }) {
  const current = stageIndex(stage);
  const done = current === ORDER_STAGES.length - 1;
  const progress = stageProgress(stage);
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6" aria-label="Order progress">
      <p className="sr-only" role="status">
        Current stage: {ORDER_STAGES[current].label}, step {current + 1} of {ORDER_STAGES.length}.
      </p>
      {/* Horizontal (sm and up) */}
      <div className="relative hidden sm:block" aria-hidden>
        <div className="absolute top-5 right-[7%] left-[7%] h-1.5 rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="relative grid grid-cols-7 gap-1">
          {ORDER_STAGES.map((item, index) => (
            <li key={item.value} className="flex flex-col items-center gap-2 text-center">
              <Dot state={stateOf(index, current, done, frozen)} index={index} />
              <span
                className={`text-xs leading-4 ${index === current ? "font-bold text-neutral-950" : index < current ? "font-medium text-neutral-700" : "text-neutral-400"}`}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {/* Vertical (phones) */}
      <ol className="relative grid gap-0 sm:hidden" aria-hidden>
        {ORDER_STAGES.map((item, index) => {
          const state = stateOf(index, current, done, frozen);
          return (
            <li key={item.value} className="relative flex min-h-12 items-start gap-3">
              {index < ORDER_STAGES.length - 1 ? (
                <span className="absolute top-10 bottom-0 left-[19px] w-1 rounded-full bg-neutral-200">
                  <span
                    className="block w-full rounded-full bg-primary transition-[height] duration-1000 ease-out motion-reduce:transition-none"
                    style={{ height: index < current ? "100%" : "0%" }}
                  />
                </span>
              ) : null}
              <Dot state={state} index={index} />
              <span
                className={`pt-2.5 text-sm ${index === current ? "font-bold text-neutral-950" : index < current ? "font-medium text-neutral-700" : "text-neutral-400"}`}
              >
                {item.label}
                {index === current && !done ? <span className="ml-2 text-xs font-semibold text-primary">Now</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type DotState = "done" | "current" | "todo" | "frozen";

function stateOf(index: number, current: number, done: boolean, frozen: boolean): DotState {
  if (index < current || (done && index === current)) return "done";
  if (index === current) return frozen ? "frozen" : "current";
  return "todo";
}

function Dot({ state, index }: { state: DotState; index: number }) {
  const base = "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold";
  if (state === "done") {
    return (
      <span className={`${base} bg-primary text-white`}>
        <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className={`${base} bg-primary text-white ring-4 ring-primary/25`}>
        <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping motion-reduce:animate-none" />
        <span className="relative">{index + 1}</span>
      </span>
    );
  }
  if (state === "frozen") return <span className={`${base} bg-neutral-400 text-white`}>{index + 1}</span>;
  return <span className={`${base} border-2 border-neutral-200 bg-white text-neutral-400`}>{index + 1}</span>;
}
