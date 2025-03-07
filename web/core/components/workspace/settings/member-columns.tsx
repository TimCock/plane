import { observer } from "mobx-react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { Disclosure } from "@headlessui/react";
import { IUser, IWorkspaceMember } from "@plane/types";
import { CustomSelect, PopoverMenu, TOAST_TYPE, setToast } from "@plane/ui";
import { EUserProjectRoles } from "@/constants/project";
import { EUserWorkspaceRoles, ROLE } from "@/constants/workspace";
import { useMember, useUser } from "@/hooks/store";

export interface RowData {
  member: IWorkspaceMember;
  role: EUserWorkspaceRoles;
}

type NameProps = {
  rowData: RowData;
  workspaceSlug: string;
  isAdmin: boolean;
  currentUser: IUser | undefined;
  setRemoveMemberModal: (rowData: RowData) => void;
};

type AccountTypeProps = {
  rowData: RowData;
  currentWorkspaceRole: EUserWorkspaceRoles | undefined;
  workspaceSlug: string;
};

export const NameColumn: React.FC<NameProps> = (props) => {
  const { rowData, workspaceSlug, isAdmin, currentUser, setRemoveMemberModal } = props;
  return (
    <Disclosure>
      {({}) => (
        <div className="relative group">
          <div className="flex items-center gap-x-4 gap-y-2 w-72 justify-between">
            <div className="flex items-center gap-x-4 gap-y-2 flex-1">
              {rowData.member.avatar && rowData.member.avatar.trim() !== "" ? (
                <Link href={`/${workspaceSlug}/profile/${rowData.member.id}`}>
                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full p-4 capitalize text-white">
                    <img
                      src={rowData.member.avatar}
                      className="absolute left-0 top-0 h-full w-full rounded-full object-cover"
                      alt={rowData.member.display_name || rowData.member.email}
                    />
                  </span>
                </Link>
              ) : (
                <Link href={`/${workspaceSlug}/profile/${rowData.member.id}`}>
                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 p-4 capitalize text-white">
                    {(rowData.member.email ?? rowData.member.display_name ?? "?")[0]}
                  </span>
                </Link>
              )}
              {rowData.member.first_name} {rowData.member.last_name}
            </div>

            {(isAdmin || rowData.member?.id === currentUser?.id) && (
              <PopoverMenu
                data={[""]}
                keyExtractor={(item) => item}
                popoverClassName="justify-end"
                buttonClassName="outline-none	origin-center rotate-90 size-8 aspect-square flex-shrink-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                render={() => (
                  <div
                    className="flex items-center gap-x-3 cursor-pointer"
                    onClick={() => setRemoveMemberModal(rowData)}
                  >
                    <Trash2 className="size-3.5 align-middle" />{" "}
                    {rowData.member?.id === currentUser?.id ? "Leave " : "Remove "}
                  </div>
                )}
              />
            )}
          </div>
        </div>
      )}
    </Disclosure>
  );
};

export const AccountTypeColumn: React.FC<AccountTypeProps> = observer((props) => {
  const { rowData, currentWorkspaceRole, workspaceSlug } = props;
  // form info
  const {
    control,
    formState: { errors },
  } = useForm();
  // store hooks
  const {
    workspace: { updateMember },
  } = useMember();
  const { data: currentUser } = useUser();

  // derived values
  const isCurrentUser = currentUser?.id === rowData.member.id;
  const isAdminRole = currentWorkspaceRole === EUserWorkspaceRoles.ADMIN;
  const isRoleNonEditable = isCurrentUser || !isAdminRole;

  return (
    <>
      {isRoleNonEditable ? (
        <div className="w-32 flex ">
          <span>{ROLE[rowData.role as keyof typeof ROLE]}</span>
        </div>
      ) : (
        <Controller
          name="role"
          control={control}
          rules={{ required: "Роль обязательна." }}
          render={({ field: { value } }) => (
            <CustomSelect
              value={value}
              onChange={(value: EUserProjectRoles) => {
                console.log({ value, workspaceSlug }, "onChange");
                if (!workspaceSlug) return;

                updateMember(workspaceSlug.toString(), rowData.member.id, {
                  role: value as unknown as EUserWorkspaceRoles, // Cast value to unknown first, then to EUserWorkspaceRoles
                }).catch((err) => {
                  console.log(err, "err");
                  const error = err.error;
                  const errorString = Array.isArray(error) ? error[0] : error;

                  setToast({
                    type: TOAST_TYPE.ERROR,
                    title: "Ошибка!",
                    message: errorString ?? "Произошла ошибка при обновлении роли участника. Повторите попытку.",
                  });
                });
              }}
              label={
                <div className="flex ">
                  <span>{ROLE[rowData.role as keyof typeof ROLE]}</span>
                </div>
              }
              buttonClassName={`!px-0 !justify-start hover:bg-custom-background-100 ${errors.role ? "border-red-500" : "border-none"}`}
              className="rounded-md p-0 w-32"
              optionsClassName="w-full"
              input
            >
              {Object.keys(ROLE).map((item) => (
                <CustomSelect.Option key={item} value={item as unknown as EUserProjectRoles}>
                  {ROLE[item as unknown as keyof typeof ROLE]}
                </CustomSelect.Option>
              ))}
            </CustomSelect>
          )}
        />
      )}
    </>
  );
});
