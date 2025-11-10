import { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import ProjectAttachmentCard from './project-attachment-card';
import { Empty } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

/**
 * Grid view component for project attachments
 * @component
 * @param {Object} props - Component props
 * @param {ITaskAttachmentViewModel[]} props.attachments - Array of attachments to display
 * @param {Function} props.onDelete - Callback when attachment is deleted
 * @param {Function} props.onDownload - Callback when attachment is downloaded
 * @param {boolean} props.downloading - Download loading state
 * @returns {JSX.Element}
 */
interface ProjectAttachmentsGridProps {
  attachments: ITaskAttachmentViewModel[];
  onDelete: (id: string | undefined) => void;
  onDownload: (id: string | undefined, filename: string | undefined) => void;
  downloading: boolean;
}

const ProjectAttachmentsGrid = ({
  attachments,
  onDelete,
  onDownload,
  downloading,
}: ProjectAttachmentsGridProps) => {
  const { t } = useTranslation('project-view-files');

  if (!attachments || attachments.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <Empty description={t('noAttachmentsFound') || 'No attachments found'} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '16px',
        padding: '16px 0',
      }}
    >
      {attachments.map(attachment => (
        <ProjectAttachmentCard
          key={attachment.id}
          attachment={attachment}
          onDelete={onDelete}
          onDownload={onDownload}
          downloading={downloading}
        />
      ))}
    </div>
  );
};

export default ProjectAttachmentsGrid;
