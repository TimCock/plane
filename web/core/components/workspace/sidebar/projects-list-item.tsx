"use client";

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { attachInstruction, extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { createRoot } from "react-dom/client";
import {
  PenSquare,
  LinkIcon,
  Star,
  FileText,
  Settings,
  Share2,
  LogOut,
  MoreHorizontal,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Disclosure, Transition } from "@headlessui/react";
// ui
import {
  CustomMenu,
  Tooltip,
  ArchiveIcon,
  DiceIcon,
  ContrastIcon,
  LayersIcon,
  setPromiseToast,
  DropIndicator,
  DragHandle,
  Intake,
} from "@plane/ui";
// components
import { Logo } from "@/components/common";
import { LeaveProjectModal, PublishProjectModal } from "@/components/project";
import { SidebarNavItem } from "@/components/sidebar";
// constants
import { EUserProjectRoles } from "@/constants/project";
// helpers
import { cn } from "@/helpers/common.helper";
// hooks
import { useAppTheme, useEventTracker, useProject, useUser } from "@/hooks/store";
import useOutsideClickDetector from "@/hooks/use-outside-click-detector";
import { usePlatformOS } from "@/hooks/use-platform-os";
// constants
import { HIGHLIGHT_CLASS, highlightIssueOnDrop } from "../../issues/issue-layouts/utils";

type Props = {
  projectId: string;
  handleCopyText: () => void;
  handleOnProjectDrop?: (
    sourceId: string | undefined,
    destinationId: string | undefined,
    shouldDropAtEnd: boolean
  ) => void;
  projectListType: "JOINED" | "FAVORITES";
  disableDrag?: boolean;
  disableDrop?: boolean;
  isLastChild: boolean;
};

const navigation = (workspaceSlug: string, projectId: string) => [
  {
    name: "Issues",
    href: `/${workspaceSlug}/projects/${projectId}/issues`,
    Icon: LayersIcon,
    access: EUserProjectRoles.GUEST,
  },
  {
    name: "Cycles",
    href: `/${workspaceSlug}/projects/${projectId}/cycles`,
    Icon: ContrastIcon,
    access: EUserProjectRoles.VIEWER,
  },
  {
    name: "Modules",
    href: `/${workspaceSlug}/projects/${projectId}/modules`,
    Icon: DiceIcon,
    access: EUserProjectRoles.VIEWER,
  },
  {
    name: "Views",
    href: `/${workspaceSlug}/projects/${projectId}/views`,
    Icon: Layers,
    access: EUserProjectRoles.GUEST,
  },
  {
    name: "Pages",
    href: `/${workspaceSlug}/projects/${projectId}/pages`,
    Icon: FileText,
    access: EUserProjectRoles.VIEWER,
  },
  {
    name: "Intake",
    href: `/${workspaceSlug}/projects/${projectId}/inbox`,
    Icon: Intake,
    access: EUserProjectRoles.GUEST,
  },
];

export const SidebarProjectsListItem: React.FC<Props> = observer((props) => {
  const { projectId, handleCopyText, disableDrag, disableDrop, isLastChild, handleOnProjectDrop, projectListType } =
    props;
  // store hooks
  const { sidebarCollapsed: isSidebarCollapsed, toggleSidebar } = useAppTheme();
  const { setTrackElement } = useEventTracker();
  const { addProjectToFavorites, removeProjectFromFavorites, getProjectById } = useProject();
  const { isMobile } = usePlatformOS();
  const {
    membership: { currentWorkspaceAllProjectsRole },
  } = useUser();
  // states
  const [leaveProjectModalOpen, setLeaveProjectModal] = useState(false);
  const [publishModalOpen, setPublishModal] = useState(false);
  const [isMenuActive, setIsMenuActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);
  const [instruction, setInstruction] = useState<"DRAG_OVER" | "DRAG_BELOW" | undefined>(undefined);
  // refs
  const actionSectionRef = useRef<HTMLDivElement | null>(null);
  const projectRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement | null>(null);
  // router params
  const { workspaceSlug, projectId: URLProjectId } = useParams();
  // pathname
  const pathname = usePathname();
  // derived values
  const project = getProjectById(projectId);
  // auth
  const isAdmin = project?.member_role === EUserProjectRoles.ADMIN;
  const isViewerOrGuest =
    project?.member_role && [EUserProjectRoles.VIEWER, EUserProjectRoles.GUEST].includes(project.member_role);

  const handleAddToFavorites = () => {
    if (!workspaceSlug || !project) return;

    const addToFavoritePromise = addProjectToFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(addToFavoritePromise, {
      loading: "Добавление проекта в избранное...",
      success: {
        title: "Успешно!",
        message: () => "Проект добавлен в избранное.",
      },
      error: {
        title: "Error!",
        message: () => "Не удалось добавить проект в избранное. Попробуйте еще раз.",
      },
    });
  };

  const handleRemoveFromFavorites = () => {
    if (!workspaceSlug || !project) return;

    const removeFromFavoritePromise = removeProjectFromFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(removeFromFavoritePromise, {
      loading: "Удаление проекта из избранного...",
      success: {
        title: "Успешно!",
        message: () => "Проект удален из избранного.",
      },
      error: {
        title: "Error!",
        message: () => "Не удалось удалить проект из избранного. Попробуйте еще раз.",
      },
    });
  };

  const handleLeaveProject = () => {
    setTrackElement("APP_SIDEBAR_PROJECT_DROPDOWN");
    setLeaveProjectModal(true);
  };

  const handleProjectClick = () => {
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  useEffect(() => {
    const element = projectRef.current;
    const dragHandleElement = dragHandleRef.current;

    if (!element) return;

    return combine(
      draggable({
        element,
        canDrag: () => !disableDrag && !isSidebarCollapsed,
        dragHandle: dragHandleElement ?? undefined,
        getInitialData: () => ({ id: projectId, dragInstanceId: "PROJECTS" }),
        onDragStart: () => {
          setIsDragging(true);
        },
        onDrop: () => {
          setIsDragging(false);
        },
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          // Add a custom drag image
          setCustomNativeDragPreview({
            getOffset: pointerOutsideOfPreview({ x: "0px", y: "0px" }),
            render: ({ container }) => {
              const root = createRoot(container);
              root.render(
                <div className="rounded flex items-center bg-custom-background-100 text-sm p-1 pr-2">
                  <div className="size-4 grid place-items-center flex-shrink-0">
                    {project && <Logo logo={project?.logo_props} />}
                  </div>
                  <p className="truncate text-custom-sidebar-text-200">{project?.name}</p>
                </div>
              );
              return () => root.unmount();
            },
            nativeSetDragImage,
          });
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          !disableDrop && source?.data?.id !== projectId && source?.data?.dragInstanceId === "PROJECTS",
        getData: ({ input, element }) => {
          const data = { id: projectId };

          // attach instruction for last in list
          return attachInstruction(data, {
            input,
            element,
            currentLevel: 0,
            indentPerLevel: 0,
            mode: isLastChild ? "last-in-group" : "standard",
          });
        },
        onDrag: ({ self }) => {
          const extractedInstruction = extractInstruction(self?.data)?.type;
          // check if the highlight is to be shown above or below
          setInstruction(
            extractedInstruction
              ? extractedInstruction === "reorder-below" && isLastChild
                ? "DRAG_BELOW"
                : "DRAG_OVER"
              : undefined
          );
        },
        onDragLeave: () => {
          setInstruction(undefined);
        },
        onDrop: ({ self, source }) => {
          setInstruction(undefined);
          const extractedInstruction = extractInstruction(self?.data)?.type;
          const currentInstruction = extractedInstruction
            ? extractedInstruction === "reorder-below" && isLastChild
              ? "DRAG_BELOW"
              : "DRAG_OVER"
            : undefined;
          if (!currentInstruction) return;

          const sourceId = source?.data?.id as string | undefined;
          const destinationId = self?.data?.id as string | undefined;

          handleOnProjectDrop && handleOnProjectDrop(sourceId, destinationId, currentInstruction === "DRAG_BELOW");

          highlightIssueOnDrop(`sidebar-${sourceId}-${projectListType}`);
        },
      })
    );
  }, [projectRef?.current, dragHandleRef?.current, projectId, isLastChild, projectListType, handleOnProjectDrop]);

  useOutsideClickDetector(actionSectionRef, () => setIsMenuActive(false));
  useOutsideClickDetector(projectRef, () => projectRef?.current?.classList?.remove(HIGHLIGHT_CLASS));

  if (!project) return null;

  useEffect(() => {
    if (URLProjectId === project.id) setIsProjectListOpen(true);
    else setIsProjectListOpen(false);
  }, [URLProjectId]);

  return (
    <>
      <PublishProjectModal isOpen={publishModalOpen} project={project} onClose={() => setPublishModal(false)} />
      <LeaveProjectModal project={project} isOpen={leaveProjectModalOpen} onClose={() => setLeaveProjectModal(false)} />
      <Disclosure key={`${project.id}_${URLProjectId}`} ref={projectRef} defaultOpen={isProjectListOpen}>
        <div
          id={`sidebar-${projectId}-${projectListType}`}
          className={cn("relative", {
            "bg-custom-sidebar-background-80 opacity-60": isDragging,
          })}
        >
          <DropIndicator classNames="absolute top-0" isVisible={instruction === "DRAG_OVER"} />
          <div
            className={cn(
              "group/project-item relative w-full px-2 py-1.5 flex items-center rounded-md text-custom-sidebar-text-100 hover:bg-custom-sidebar-background-90",
              {
                "bg-custom-sidebar-background-90": isMenuActive,
                "p-0 size-8 aspect-square justify-center mx-auto": isSidebarCollapsed,
              }
            )}
            id={`${project?.id}`}
          >
            {!disableDrag && (
              <Tooltip
                isMobile={isMobile}
                tooltipContent={project.sort_order === null ? "Join the project to rearrange" : "Drag to rearrange"}
                position="top-right"
                disabled={isDragging}
              >
                <button
                  type="button"
                  className={cn(
                    "hidden group-hover/project-item:flex items-center justify-center absolute top-1/2 -left-3 -translate-y-1/2 rounded text-custom-sidebar-text-400 cursor-grab",
                    {
                      "cursor-not-allowed opacity-60": project.sort_order === null,
                      "cursor-grabbing": isDragging,
                      flex: isMenuActive,
                      "!hidden": isSidebarCollapsed,
                    }
                  )}
                  ref={dragHandleRef}
                >
                  <DragHandle className="bg-transparent" />
                </button>
              </Tooltip>
            )}
            {isSidebarCollapsed ? (
              <Link
                href={`/${workspaceSlug}/projects/${project.id}/issues`}
                className={cn("flex-grow flex items-center gap-1.5 truncate text-left select-none", {
                  "justify-center": isSidebarCollapsed,
                })}
              >
                <Disclosure.Button
                  as="button"
                  className="size-8 aspect-square flex-shrink-0 grid place-items-center"
                  onClick={() => setIsProjectListOpen(!isProjectListOpen)}
                >
                  <div className="size-4 grid place-items-center flex-shrink-0">
                    <Logo logo={project.logo_props} size={16} />
                  </div>
                </Disclosure.Button>
              </Link>
            ) : (
              <>
                <Tooltip
                  tooltipContent={`${project.name}`}
                  position="right"
                  disabled={!isSidebarCollapsed}
                  isMobile={isMobile}
                >
                  <Link href={`/${workspaceSlug}/projects/${project.id}/issues`} className="flex-grow flex truncate">
                    <Disclosure.Button
                      as="button"
                      type="button"
                      className={cn("flex-grow flex items-center gap-1.5 text-left select-none w-full", {
                        "justify-center": isSidebarCollapsed,
                      })}
                      onClick={() => setIsProjectListOpen(!isProjectListOpen)}
                    >
                      <div className="size-4 grid place-items-center flex-shrink-0">
                        <Logo logo={project.logo_props} size={16} />
                      </div>
                      <p className="truncate text-sm font-medium text-custom-sidebar-text-200">{project.name}</p>
                    </Disclosure.Button>
                  </Link>
                </Tooltip>
                <CustomMenu
                  customButton={
                    <span
                      ref={actionSectionRef}
                      className="grid place-items-center p-0.5 text-custom-sidebar-text-400 hover:bg-custom-sidebar-background-80 rounded"
                      onClick={() => setIsMenuActive(!isMenuActive)}
                    >
                      <MoreHorizontal className="size-4" />
                    </span>
                  }
                  className={cn(
                    "opacity-0 pointer-events-none flex-shrink-0 group-hover/project-item:opacity-100 group-hover/project-item:pointer-events-auto",
                    {
                      "opacity-100 pointer-events-auto": isMenuActive,
                    }
                  )}
                  customButtonClassName="grid place-items-center"
                  placement="bottom-start"
                >
                  {!isViewerOrGuest && (
                    <CustomMenu.MenuItem
                      onClick={project.is_favorite ? handleRemoveFromFavorites : handleAddToFavorites}
                    >
                      <span className="flex items-center justify-start gap-2">
                        <Star
                          className={cn("h-3.5 w-3.5 ", {
                            "fill-yellow-500 stroke-yellow-500": project.is_favorite,
                          })}
                        />
                        <span>{project.is_favorite ? "Remove from favorites" : "Add to favorites"}</span>
                      </span>
                    </CustomMenu.MenuItem>
                  )}

                  {/* publish project settings */}
                  {isAdmin && (
                    <CustomMenu.MenuItem onClick={() => setPublishModal(true)}>
                      <div className="relative flex flex-shrink-0 items-center justify-start gap-2">
                        <div className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-custom-sidebar-text-200 transition-all duration-300 hover:bg-custom-sidebar-background-80">
                          <Share2 className="h-3.5 w-3.5 stroke-[1.5]" />
                        </div>
                        <div>{project.anchor ? "Publish settings" : "Publish"}</div>
                      </div>
                    </CustomMenu.MenuItem>
                  )}
                  {!isViewerOrGuest && (
                    <CustomMenu.MenuItem>
                      <Link href={`/${workspaceSlug}/projects/${project?.id}/draft-issues/`}>
                        <div className="flex items-center justify-start gap-2">
                          <PenSquare className="h-3.5 w-3.5 stroke-[1.5] text-custom-text-300" />
                          <span>Draft issues</span>
                        </div>
                      </Link>
                    </CustomMenu.MenuItem>
                  )}
                  <CustomMenu.MenuItem onClick={handleCopyText}>
                    <span className="flex items-center justify-start gap-2">
                      <LinkIcon className="h-3.5 w-3.5 stroke-[1.5]" />
                      <span>Copy link</span>
                    </span>
                  </CustomMenu.MenuItem>
                  {!isViewerOrGuest && (
                    <CustomMenu.MenuItem>
                      <Link href={`/${workspaceSlug}/projects/${project?.id}/archives/issues`}>
                        <div className="flex items-center justify-start gap-2">
                          <ArchiveIcon className="h-3.5 w-3.5 stroke-[1.5]" />
                          <span>Archives</span>
                        </div>
                      </Link>
                    </CustomMenu.MenuItem>
                  )}
                  <CustomMenu.MenuItem>
                    <Link href={`/${workspaceSlug}/projects/${project?.id}/settings`}>
                      <div className="flex items-center justify-start gap-2">
                        <Settings className="h-3.5 w-3.5 stroke-[1.5]" />
                        <span>Settings</span>
                      </div>
                    </Link>
                  </CustomMenu.MenuItem>
                  {/* leave project */}
                  {isViewerOrGuest && (
                    <CustomMenu.MenuItem onClick={handleLeaveProject}>
                      <div className="flex items-center justify-start gap-2">
                        <LogOut className="h-3.5 w-3.5 stroke-[1.5]" />
                        <span>Leave project</span>
                      </div>
                    </CustomMenu.MenuItem>
                  )}
                </CustomMenu>
                <Disclosure.Button
                  as="button"
                  type="button"
                  className={cn(
                    "hidden group-hover/project-item:inline-block p-0.5 rounded hover:bg-custom-sidebar-background-80",
                    {
                      "inline-block": isMenuActive,
                    }
                  )}
                  onClick={() => setIsProjectListOpen(!isProjectListOpen)}
                >
                  <ChevronRight
                    className={cn("size-4 flex-shrink-0 text-custom-sidebar-text-400 transition-transform", {
                      "rotate-90": isProjectListOpen,
                    })}
                  />
                </Disclosure.Button>
              </>
            )}
          </div>
          <Transition
            show={isProjectListOpen}
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            {isProjectListOpen && (
              <Disclosure.Panel as="div" className="flex flex-col gap-0.5 mt-1">
                {navigation(workspaceSlug?.toString(), project?.id).map((item) => {
                  if (
                    (item.name === "Cycles" && !project.cycle_view) ||
                    (item.name === "Modules" && !project.module_view) ||
                    (item.name === "Views" && !project.issue_views_view) ||
                    (item.name === "Pages" && !project.page_view) ||
                    (item.name === "Intake" && !project.inbox_view)
                  )
                    return;
                  const currentRole = currentWorkspaceAllProjectsRole
                    ? currentWorkspaceAllProjectsRole[projectId]
                    : undefined;
                  return (
                    <>
                      {currentRole >= item.access && (
                        <Tooltip
                          key={item.name}
                          isMobile={isMobile}
                          tooltipContent={`${project?.name}: ${item.name}`}
                          position="right"
                          className="ml-2"
                          disabled={!isSidebarCollapsed}
                        >
                          <Link key={item.name} href={item.href} onClick={handleProjectClick}>
                            <SidebarNavItem
                              key={item.name}
                              className={`pl-[18px]  ${isSidebarCollapsed ? "p-0 size-7 justify-center mx-auto" : ""}`}
                              isActive={pathname.includes(item.href)}
                            >
                              <div className="flex items-center gap-1.5 py-[1px]">
                                <item.Icon
                                  className={`flex-shrink-0 size-4 ${item.name === "Intake" ? "stroke-1" : "stroke-[1.5]"}`}
                                />
                                {!isSidebarCollapsed && <span className="text-xs font-medium">{item.name}</span>}
                              </div>
                            </SidebarNavItem>
                          </Link>
                        </Tooltip>
                      )}
                    </>
                  );
                })}
              </Disclosure.Panel>
            )}
          </Transition>
          {isLastChild && <DropIndicator isVisible={instruction === "DRAG_BELOW"} />}
        </div>
      </Disclosure>
    </>
  );
});
