type WithdrawableApplication = {
  status_code: string;
  round_open: boolean;
  allow_withdrawal: boolean;
};

type ReapplicableApplication = {
  status_code: string;
  round_open: boolean;
  has_active_application: boolean;
  has_newer_application: boolean;
};

export function canWithdrawApplication(application: WithdrawableApplication) {
  return application.round_open && application.allow_withdrawal && ["Submitted", "Interview"].includes(application.status_code);
}

export function canReapplyToApplication(application: ReapplicableApplication) {
  return application.round_open && application.status_code === "Withdrawn" && !application.has_active_application && !application.has_newer_application;
}
