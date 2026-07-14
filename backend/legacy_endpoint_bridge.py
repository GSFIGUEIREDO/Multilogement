from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from backend.legacy_auth_handlers import (
    handle_login as handle_legacy_login,
    handle_logout as handle_legacy_logout,
    handle_password_reset_confirm as handle_legacy_password_reset_confirm,
    handle_password_reset_request as handle_legacy_password_reset_request,
    handle_session as handle_legacy_session,
    handle_signup as handle_legacy_signup,
)
from backend.legacy_domain_handlers import (
    handle_delete_reminder as handle_legacy_delete_reminder,
    handle_delete_setting_item as handle_legacy_delete_setting_item,
    handle_delete_user as handle_legacy_delete_user,
    handle_report_context as handle_legacy_report_context,
    handle_save_apartment as handle_legacy_save_apartment,
    handle_save_building as handle_legacy_save_building,
    handle_save_equipment as handle_legacy_save_equipment,
    handle_save_field_intervention as handle_legacy_save_field_intervention,
    handle_save_intervention as handle_legacy_save_intervention,
    handle_save_reminder as handle_legacy_save_reminder,
    handle_save_setting_item as handle_legacy_save_setting_item,
    handle_save_ticket as handle_legacy_save_ticket,
    handle_save_user as handle_legacy_save_user,
    handle_save_work_order as handle_legacy_save_work_order,
)
from backend.legacy_file_handlers import (
    handle_file_delete as handle_legacy_file_delete,
    handle_file_upload as handle_legacy_file_upload,
    handle_file_url as handle_legacy_file_url,
    handle_local_file as handle_legacy_local_file,
)
from backend.legacy_state_handlers import handle_save_state as handle_legacy_save_state


@dataclass(frozen=True)
class LegacyEndpointContext:
    db: Callable
    get_state: Callable
    save_state: Callable
    sync_users: Callable
    sync_relational_tables_safely: Callable
    ensure_bootstrap_state: Callable
    public_base_url: Callable


class LegacyEndpointMixin:
    legacy_context: LegacyEndpointContext

    def handle_session(self) -> None:
        ctx = self.legacy_context
        handle_legacy_session(self, db=ctx.db, get_state=ctx.get_state)

    def handle_login(self) -> None:
        handle_legacy_login(self, ensure_bootstrap_state=self.legacy_context.ensure_bootstrap_state)

    def handle_signup(self) -> None:
        ctx = self.legacy_context
        handle_legacy_signup(
            self,
            ensure_bootstrap_state=ctx.ensure_bootstrap_state,
            sync_relational_tables_safely=ctx.sync_relational_tables_safely,
        )

    def handle_password_reset_request(self) -> None:
        ctx = self.legacy_context
        handle_legacy_password_reset_request(
            self,
            ensure_bootstrap_state=ctx.ensure_bootstrap_state,
            public_base_url=ctx.public_base_url,
            sync_relational_tables_safely=ctx.sync_relational_tables_safely,
        )

    def handle_password_reset_confirm(self) -> None:
        ctx = self.legacy_context
        handle_legacy_password_reset_confirm(
            self,
            ensure_bootstrap_state=ctx.ensure_bootstrap_state,
            sync_relational_tables_safely=ctx.sync_relational_tables_safely,
        )

    def handle_logout(self) -> None:
        handle_legacy_logout(self)

    def handle_file_upload(self) -> None:
        handle_legacy_file_upload(self)

    def handle_file_url(self) -> None:
        handle_legacy_file_url(self)

    def handle_file_delete(self) -> None:
        handle_legacy_file_delete(self)

    def handle_local_file(self, parsed) -> None:
        ctx = self.legacy_context
        handle_legacy_local_file(self, parsed, db=ctx.db, get_state=ctx.get_state)

    def handle_save_state(self) -> None:
        ctx = self.legacy_context
        handle_legacy_save_state(
            self,
            db=ctx.db,
            get_state=ctx.get_state,
            save_state=ctx.save_state,
            sync_users=ctx.sync_users,
            sync_relational_tables_safely=ctx.sync_relational_tables_safely,
        )

    def handle_save_equipment(self) -> None:
        handle_legacy_save_equipment(self, sync_relational_tables_safely=self.legacy_context.sync_relational_tables_safely)

    def handle_save_user(self) -> None:
        handle_legacy_save_user(self)

    def handle_delete_user(self) -> None:
        handle_legacy_delete_user(self)

    def handle_save_building(self) -> None:
        handle_legacy_save_building(self, sync_relational_tables_safely=self.legacy_context.sync_relational_tables_safely)

    def handle_save_apartment(self) -> None:
        handle_legacy_save_apartment(self, sync_relational_tables_safely=self.legacy_context.sync_relational_tables_safely)

    def handle_save_ticket(self) -> None:
        handle_legacy_save_ticket(self, sync_relational_tables_safely=self.legacy_context.sync_relational_tables_safely)

    def handle_save_work_order(self) -> None:
        handle_legacy_save_work_order(self, sync_relational_tables_safely=self.legacy_context.sync_relational_tables_safely)

    def handle_save_intervention(self) -> None:
        handle_legacy_save_intervention(self, sync_relational_tables_safely=self.legacy_context.sync_relational_tables_safely)

    def handle_save_field_intervention(self) -> None:
        handle_legacy_save_field_intervention(self)

    def handle_save_reminder(self) -> None:
        handle_legacy_save_reminder(self, sync_relational_tables_safely=self.legacy_context.sync_relational_tables_safely)

    def handle_delete_reminder(self) -> None:
        handle_legacy_delete_reminder(self)

    def handle_report_context(self) -> None:
        handle_legacy_report_context(self)

    def handle_save_setting_item(self) -> None:
        handle_legacy_save_setting_item(self, sync_relational_tables_safely=self.legacy_context.sync_relational_tables_safely)

    def handle_delete_setting_item(self) -> None:
        handle_legacy_delete_setting_item(self, sync_relational_tables_safely=self.legacy_context.sync_relational_tables_safely)
