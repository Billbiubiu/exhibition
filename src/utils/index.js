/**
* 转动工具，总是以锐角进行转动
* @param {*} source 当前角度
* @param {*} target 目标角度
* @returns 
*/
export const getRotation = (source, target) => {
 let makedSource = source % (Math.PI * 2);
 makedSource = makedSource < 0 ? makedSource + (Math.PI * 2) : makedSource;
 let makedTarget = target % (Math.PI * 2);
 makedTarget = makedTarget < 0 ? makedTarget + (Math.PI * 2) : makedTarget;
 const diff = makedTarget - makedSource;
 // 差值大于180度，需要反方向旋转
 if (diff > Math.PI) {
   return source - (Math.PI * 2 - diff);
 } else if (diff < -Math.PI) {
   return source + (Math.PI * 2 + diff);
 } else {
   return source + diff;
 }
};
