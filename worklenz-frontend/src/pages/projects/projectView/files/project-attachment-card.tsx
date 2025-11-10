import { useState } from 'react';
import { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import { Button, Modal, Tooltip, Typography, Popconfirm } from '@/shared/antd-imports';
import {
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
} from '@/shared/antd-imports';
import { IconsMap } from '@/shared/constants';
import './project-attachment-card.css';

/**
 * Individual attachment card component with preview functionality
 * @component
 * @param {Object} props - Component props
 * @param {ITaskAttachmentViewModel} props.attachment - Attachment data
 * @param {Function} props.onDelete - Delete callback
 * @param {Function} props.onDownload - Download callback
 * @param {boolean} props.downloading - Download loading state
 * @returns {JSX.Element}
 */
interface ProjectAttachmentCardProps {
  attachment: ITaskAttachmentViewModel;
  onDelete: (id: string | undefined) => void;
  onDownload: (id: string | undefined, filename: string | undefined) => void;
  downloading: boolean;
}

const ProjectAttachmentCard = ({
  attachment,
  onDelete,
  onDownload,
  downloading,
}: ProjectAttachmentCardProps) => {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [currentFileType, setCurrentFileType] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState(768);

  /**
   * Get file icon path for the attachment type
   * @param {string} type - File extension
   * @returns {string} Icon filename
   */
  const getFileIcon = (type?: string) => {
    if (!type) return 'search.png';
    return IconsMap[type] || 'search.png';
  };

  /**
   * Check if attachment is an image
   * @returns {boolean}
   */
  const isImageFile = (): boolean => {
    const imageTypes = ['jpeg', 'jpg', 'bmp', 'gif', 'webp', 'png', 'ico'];
    const type = attachment?.type;
    if (type) return imageTypes.includes(type);
    return false;
  };

  /**
   * Check if file extension is an image
   * @param {string} extension - File extension
   * @returns {boolean}
   */
  const isImage = (extension: string): boolean => {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico'].includes(extension);
  };

  /**
   * Check if file extension is a video
   * @param {string} extension - File extension
   * @returns {boolean}
   */
  const isVideo = (extension: string): boolean => {
    return ['mp4', 'webm', 'ogg'].includes(extension);
  };

  /**
   * Check if file extension is audio
   * @param {string} extension - File extension
   * @returns {boolean}
   */
  const isAudio = (extension: string): boolean => {
    return ['mp3', 'wav', 'ogg'].includes(extension);
  };

  /**
   * Check if file extension is a document
   * @param {string} extension - File extension
   * @returns {boolean}
   */
  const isDoc = (extension: string): boolean => {
    return ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'pdf'].includes(extension);
  };

  /**
   * Open preview modal for the attachment
   */
  const handlePreview = () => {
    if (!attachment.url) return;

    const extension = attachment.url.split('.').pop()?.toLowerCase();

    if (!extension) return;

    setIsPreviewVisible(true);

    if (isImage(extension)) {
      setCurrentFileType('image');
      setPreviewWidth(768);
    } else if (isVideo(extension)) {
      setCurrentFileType('video');
      setPreviewWidth(768);
    } else if (isAudio(extension)) {
      setPreviewWidth(600);
      setCurrentFileType('audio');
    } else if (isDoc(extension)) {
      setCurrentFileType('document');
      setPreviewWidth(1024);
    } else {
      setPreviewWidth(600);
      setCurrentFileType('unknown');
    }
  };

  /**
   * Close preview modal
   */
  const handleClosePreview = () => {
    setIsPreviewVisible(false);
  };

  return (
    <>
      <div className="project-attachment-card">
        <Tooltip
          title={
            <div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{attachment.name}</p>
              <p style={{ margin: 0 }}>Task: {attachment.task_name}</p>
              <p style={{ margin: 0 }}>Size: {attachment.size}</p>
              <p style={{ margin: 0 }}>
                Uploaded: {attachment.created_at ? new Date(attachment.created_at).toLocaleString() : ''}
              </p>
              <p style={{ margin: 0 }}>By: {attachment.uploader_name}</p>
            </div>
          }
          placement="bottom"
        >
          <div className="attachment-card-content">
            <img
              src={`/file-types/${getFileIcon(attachment.type)}`}
              className="attachment-file-icon"
              alt=""
            />
            <div
              className="attachment-thumbnail"
              style={{
                backgroundImage: isImageFile() ? `url(${attachment.url})` : '',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {!isImageFile() && (
                <span
                  className="anticon anticon-file-unknown"
                  style={{ fontSize: 48, color: '#cccccc' }}
                />
              )}
            </div>
            <div className="attachment-card-footer">
              <Typography.Text ellipsis style={{ fontSize: 12 }}>
                {attachment.name}
              </Typography.Text>
            </div>
          </div>
        </Tooltip>

        <div className="attachment-card-actions">
          <Button
            type="text"
            size="small"
            title="Preview file"
            onClick={handlePreview}
            className="attachment-action-btn"
          >
            <EyeOutlined />
          </Button>

          <Button
            type="text"
            size="small"
            title="Download file"
            onClick={() => onDownload(attachment.id, attachment.name)}
            loading={downloading}
            className="attachment-action-btn"
          >
            <DownloadOutlined />
          </Button>

          <Popconfirm
            title="Delete Attachment"
            description="Are you sure you want to delete this attachment?"
            icon={<QuestionCircleOutlined style={{ color: 'red' }} />}
            onConfirm={() => onDelete(attachment.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              size="small"
              title="Remove file"
              className="attachment-action-btn"
            >
              <DeleteOutlined />
            </Button>
          </Popconfirm>
        </div>
      </div>

      <Modal
        open={isPreviewVisible}
        title={<Typography.Text>{attachment?.name}</Typography.Text>}
        centered
        onCancel={handleClosePreview}
        width={previewWidth}
        className="attachment-preview-modal"
        footer={[
          <Button
            key="download"
            onClick={() => onDownload(attachment.id, attachment.name)}
            loading={downloading}
          >
            <DownloadOutlined /> Download
          </Button>,
        ]}
      >
        <div className="preview-container text-center position-relative">
          {currentFileType === 'image' && (
            <img src={attachment.url || ''} className="img-fluid position-relative" alt="" />
          )}

          {currentFileType === 'video' && (
            <video className="position-relative" controls>
              <source src={attachment.url || ''} type="video/mp4" />
            </video>
          )}

          {currentFileType === 'audio' && (
            <audio className="position-relative" controls>
              <source src={attachment.url || ''} type="audio/mpeg" />
            </audio>
          )}

          {currentFileType === 'document' && (
            <>
              {attachment.url && (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(attachment.url)}&embedded=true`}
                  width="100%"
                  height="500px"
                  style={{ border: 'none' }}
                  title="Document preview"
                />
              )}
            </>
          )}

          {currentFileType === 'unknown' && <p>The preview for this file type is not available.</p>}
        </div>
      </Modal>
    </>
  );
};

export default ProjectAttachmentCard;
