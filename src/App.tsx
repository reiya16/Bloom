import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppDataProvider, useAppData } from "@/state/AppData";
import Welcome from "@/components/Welcome";
import ResetPasswordScreen from "@/components/ResetPasswordScreen";
import Onboarding from "@/components/onboarding/Onboarding";
import TabBar, { type TabId } from "@/components/TabBar";
import Today from "@/components/Today";
import Train from "@/components/Train";
import Plan from "@/components/Plan";
import Library from "@/components/Library";
import Progress from "@/components/Progress";
import Settings from "@/components/Settings";
import ComingSoon from "@/components/ComingSoon";
import { Button, Card, Muted, Page, Spinner, Title } from "@/components/ui";

type Overlay = { type: "plan" } | { type: "library"; workoutId: string } | { type: "settings" } | null;

export default function App() {
  const { session, loading, isPasswordRecovery } = useAuth();

  if (loading) return <Spinner />;
  // Arriving from a "reset password" email: show the set-new-password screen first.
  if (isPasswordRecovery) return <ResetPasswordScreen />;
  if (!session) return <Welcome />;

  return (
    <AppDataProvider userId={session.user.id}>
      <Shell />
    </AppDataProvider>
  );
}

function Shell() {
  const { loading, loadError, profile, refresh } = useAppData();
  const [openPlanFirst, setOpenPlanFirst] = useState(false);

  if (loading) return <Spinner />;

  if (loadError) {
    return (
      <Page>
        <Title>Couldn&apos;t load your data</Title>
        <Card className="flex flex-col gap-2">
          <Muted>{loadError}</Muted>
          <Muted className="text-[13px]">
            If you just updated Bloom, make sure the database update (0002_bloom_foundation.sql) has been run in Supabase.
          </Muted>
        </Card>
        <Button onClick={() => refresh()}>Try again</Button>
      </Page>
    );
  }

  if (!profile?.onboarding_done) {
    return <Onboarding onFinish={(openPlan) => setOpenPlanFirst(openPlan)} />;
  }

  return <MainApp startOnPlan={openPlanFirst} />;
}

function MainApp({ startOnPlan }: { startOnPlan: boolean }) {
  const [tab, setTab] = useState<TabId>("today");
  const [overlay, setOverlay] = useState<Overlay>(startOnPlan ? { type: "plan" } : null);
  const [startWorkoutId, setStartWorkoutId] = useState<string | null>(null);

  const closeOverlay = () => setOverlay(null);
  const goTab = (t: TabId) => {
    setOverlay(null);
    setTab(t);
  };

  let content: JSX.Element;
  if (overlay?.type === "plan") {
    content = <Plan onBack={closeOverlay} onAddExercises={(workoutId) => setOverlay({ type: "library", workoutId })} />;
  } else if (overlay?.type === "library") {
    content = <Library workoutId={overlay.workoutId} onBack={() => setOverlay({ type: "plan" })} />;
  } else if (overlay?.type === "settings") {
    content = <Settings onBack={closeOverlay} />;
  } else if (tab === "today") {
    content = (
      <Today
        onStart={(id) => {
          setStartWorkoutId(id);
          setTab("train");
        }}
        onEditPlan={() => setOverlay({ type: "plan" })}
        onOpenSettings={() => setOverlay({ type: "settings" })}
        onChooseWorkout={() => setTab("train")}
      />
    );
  } else if (tab === "train") {
    content = (
      <Train
        startWorkoutId={startWorkoutId}
        onStartConsumed={() => setStartWorkoutId(null)}
        onFinished={() => setTab("today")}
        onEditPlan={() => setOverlay({ type: "plan" })}
      />
    );
  } else if (tab === "progress") {
    content = <Progress />;
  } else if (tab === "eat") {
    content = <ComingSoon title="Eat" blurb="Track calories and protein, with Coach keeping an eye on carbs and fat. Coming after training and Coach." />;
  } else {
    content = <ComingSoon title="Coach" blurb="Coach will spot stalled lifts and missed workouts, and can suggest plan changes for you to approve." />;
  }

  const hideTabs = overlay?.type === "library";
  return (
    <div className="mx-auto flex h-full w-full max-w-[520px] flex-col">
      <div className="relative min-h-0 flex-1">{content}</div>
      {!hideTabs && <TabBar active={overlay ? (overlay.type === "settings" || overlay.type === "plan" ? "today" : tab) : tab} onChange={goTab} />}
    </div>
  );
}
